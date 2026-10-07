/**
 * CP-C0 edit leg (scope.md CB-4, F-050 #1; not app code, never imported by src/): on each library song, OPEN
 * its thread, SEND one edit per kind, APPLY the edit card and follow the job until the version saves. Per edit:
 * turn time + planner window (chatCp0Run.turnOn), APPLY hand-off and wall time, yue-server's splice verdict and
 * seams (`GET /v1/splices/:id`; the id is read from the server's log line "chat edit <job>: splice <id>"), and
 * yue-server/splice_check.py run in WSL on the saved file against its base. Each kind starts from v1 again
 * (USE v1 = the activate route), so every saved version is a v1 -> vN pair; the pairs are copied for a listen.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { json, now, sleep } from './scoreCp1Lib.js';
import { follow, thread, turnOn, type RunCtx } from './chatCp0Run.js';
import type { ApplyResult, CheckReport, EditKind, EditResult, Seam } from './chatCp0EditStats.js';

export const EDITS: Array<{ kind: EditKind; text: string }> = [
  { kind: 'reharmonize', text: 'give the chorus jazz chords' },
  { kind: 'cut', text: 'cut the second verse' },
  { kind: 'repeat', text: 'repeat the chorus' },
  { kind: 'rewrite', text: 'rewrite the chorus lyrics about rain' },
];

export interface EditOpts {
  songs: string[];
  out: string;
  /** server/data copy the server runs on: the base and saved audio are read from <dataDir>/audio. */
  dataDir: string;
  yue: string;
  /** The server's stdout log (for the splice id). */
  serverLog: string;
  /** Where the v1 / vN pairs are copied for the owner's listen; '' = none. */
  listen: string;
  /** Run splice_check.py in WSL (Ubuntu-24.04, ~/yue2/.venv). */
  wslCheck: boolean;
  applyTimeoutMs: number;
}

const toWsl = (p: string) => path.resolve(p).replace(/^([A-Za-z]):/, (_m, d: string) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, '/');
const CHECK = path.resolve(import.meta.dirname, '../../yue-server/splice_check.py');

function audioOf(dataDir: string, versionId: string): string | null {
  const dir = path.join(dataDir, 'audio');
  const f = fs.readdirSync(dir).find((n) => n.startsWith(`${versionId}.`) && !/\.(abc|json)$/.test(n));
  return f ? path.join(dir, f) : null;
}

function spliceIdFor(logFile: string, jobId: string): string | null {
  const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  return new RegExp(`chat edit ${jobId}: splice (\\S+) on`).exec(text)?.[1] ?? null;
}

/** splice_check.py on the saved library file; null + the error when it could not run. */
function spliceCheck(base: string, saved: string, resultFile: string): { report: CheckReport | null; error?: string } {
  if (!fs.existsSync(CHECK)) return { report: null, error: 'yue-server/splice_check.py not found' };
  const cmd = `cd ${toWsl(path.dirname(CHECK))} && ~/yue2/.venv/bin/python splice_check.py '${toWsl(base)}' '${toWsl(saved)}' '${toWsl(resultFile)}'`;
  const run = spawnSync('wsl.exe', ['-d', 'Ubuntu-24.04', '--exec', 'bash', '-lc', cmd], { encoding: 'utf8', timeout: 300_000 });
  try { return { report: JSON.parse(run.stdout) as CheckReport }; } catch { return { report: null, error: `exit ${run.status}: ${(run.stderr || run.stdout || '').slice(-300)}` }; }
}

async function apply(ctx: RunCtx, o: EditOpts, threadId: string, proposalId: string, tag: string): Promise<ApplyResult & { previous: string | null }> {
  const none = { handoffMs: null, editMs: null, versionId: null, number: null, label: null, whole: false, fallback: null, spliceId: null,
    verdict: null, verdictReason: null, nullTest: null, seams: [] as Seam[], check: null, previous: null };
  const press = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/apply`, { proposalId });
  if (post.status !== 202) return { ...none, postStatus: post.status, outcome: 'refused', reason: JSON.stringify(post.body) };
  const jobId = (post.body as { jobId: string }).jobId;
  let phase = '';
  const f = await follow(ctx, jobId, o.applyTimeoutMs, (j) => {
    const s = `${j.status} ${j.progressText ?? ''} ${j.progressStage ?? ''}`.trim();
    if (s !== phase) { phase = s; ctx.log(`  apply ${tag}: ${s} (+${((now() - press) / 1000).toFixed(1)} s)`); }
  });
  const out: ApplyResult & { previous: string | null } = {
    ...none, postStatus: 202, jobId, outcome: f.timedOut ? 'timeout' : f.last?.status === 'done' ? 'saved' : 'failed',
    reason: f.last?.error ? String(f.last.error) : undefined, handoffMs: f.runningAt === null ? null : f.runningAt - press, editMs: f.endAt - press,
  };
  for (let i = 0; out.outcome === 'saved' && i < 50 && !out.versionId; i++) {
    const card = (await thread(ctx, threadId)).messages.find((m) => m.kind === 'version' && m.jobId === jobId);
    const b = card?.body as { number?: number; label?: string; whole?: boolean; fallback?: string | null; previous?: { versionId: string } | null } | undefined;
    if (card && b) Object.assign(out, { versionId: (card as { versionId?: string }).versionId ?? null, number: b.number ?? null, label: b.label ?? null, whole: Boolean(b.whole), fallback: b.fallback ?? null, previous: b.previous?.versionId ?? null });
    else await sleep(100);
  }
  out.spliceId = spliceIdFor(o.serverLog, jobId);
  if (!out.spliceId) return out;
  const rec = await json('GET', `${o.yue}/v1/splices/${out.spliceId}`);
  const result = (rec.body as { result?: Record<string, unknown> } | null)?.result ?? null;
  const resultFile = path.join(o.out, 'splices', `${tag}.json`);
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify(rec.body, null, 1));
  if (!result) return out;
  Object.assign(out, {
    verdict: result.verdict ?? null, verdictReason: [result.reason, result.detail].filter(Boolean).join(': ') || null,
    nullTest: result.null_test ?? null, seams: (result.seams as Seam[] | undefined) ?? [],
  });
  const base = out.previous && audioOf(o.dataDir, out.previous);
  const saved = out.versionId && audioOf(o.dataDir, out.versionId);
  if (o.wslCheck && result.verdict === 'ok' && !out.whole && base && saved) {
    const c = spliceCheck(base, saved, resultFile);
    out.check = c.report;
    if (c.error) out.checkError = c.error;
  }
  return out;
}

function copyPair(o: EditOpts, title: string, kind: string, v1: string, vN: string, n: number | null) {
  if (!o.listen) return;
  fs.mkdirSync(o.listen, { recursive: true });
  const safe = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'song';
  for (const [id, name] of [[v1, `${safe}-v1`], [vN, `${safe}-${kind}-v${n ?? 'N'}`]] as const) {
    const src = audioOf(o.dataDir, id);
    if (src) fs.copyFileSync(src, path.join(o.listen, `${name}${path.extname(src)}`));
  }
}

/** The whole leg; `onEdit` is called after each edit (the caller saves the evidence as it goes). */
export async function runEditLeg(ctx: RunCtx, o: EditOpts, onEdit: (r: EditResult) => void): Promise<void> {
  let index = 0;
  for (const song of o.songs) {
    const t = await json('GET', `${ctx.server}/api/chat/songs/${song}/thread`);
    if (t.status !== 200) throw new Error(`OPEN ${song}: ${t.status} ${JSON.stringify(t.body)}`);
    const threadId = (t.body as { id: string }).id;
    const title = String((await json('GET', `${ctx.server}/api/songs/${song}`)).body?.title ?? song.slice(0, 8));
    let v1: string | null = null;
    for (const e of EDITS) {
      const tag = `${song.slice(0, 8)}-${e.kind}`;
      if (v1) await json('PATCH', `${ctx.server}/api/layers/versions/${v1}/activate`); // every kind edits v1
      const { result: turn, reply } = await turnOn(ctx, threadId, { index: index++, id: tag, lang: 'en', expect: 'edit' }, e.text);
      const planned = reply?.kind === 'edit' ? ((reply.body as { splice?: EditResult['planned'] } | null)?.splice ?? null) : null;
      ctx.log(`${title} ${e.kind}: ${turn.action ?? 'no reply'} in ${((turn.turnMs ?? 0) / 1000).toFixed(1)} s, unload ${turn.unloadMs ?? '-'} ms, ${planned ? JSON.stringify(planned) : (reply?.text ?? turn.reasons[0] ?? '').slice(0, 160)}`);
      const a = reply?.kind === 'edit' && reply.proposalId ? await apply(ctx, o, threadId, reply.proposalId, tag) : null;
      if (a) ctx.log(`${title} ${e.kind}: APPLY ${a.outcome}${a.reason ? ` (${a.reason})` : ''}, hand-off ${a.handoffMs ?? '-'} ms, edit ${((a.editMs ?? 0) / 1000).toFixed(1)} s, v${a.number ?? '-'} "${a.label ?? ''}", verdict ${a.verdict ?? '-'} ${a.verdictReason ?? ''}`);
      if (a?.previous) v1 ??= a.previous;
      if (a?.versionId && v1) copyPair(o, title, e.kind, v1, a.versionId, a.number);
      const { previous: _p, ...applyResult } = a ?? { previous: null };
      onEdit({ song, title, kind: e.kind, turn, planned, apply: a ? (applyResult as ApplyResult) : null });
    }
    if (v1) await json('PATCH', `${ctx.server}/api/layers/versions/${v1}/activate`);
  }
}
