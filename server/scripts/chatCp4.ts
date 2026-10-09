/**
 * CP-C4 (scope.md C4 CK-4, F-069 #6, R-043; not app code, never imported by src/): multi-op chat edits on library songs,
 * headless, through the server's own chat routes. Per plan (a `--plans` JSON row): OPEN the song's thread, USE its base
 * version, SEND the request (the next wording when the reply is not an edit card with 2+ ops), APPLY the card and follow
 * the job; then the base layer's version count (one version or none), the saved `params_json.splice`, yue-server's chain
 * record (`GET /v1/splices/:id`: per-step verdict, snaps, gains, joins, null test, timing), the splice job dir's bytes, and
 * `splice_check.py --chain` in WSL on the saved file against the original base. Stop lines in chatCp4Stats.ts.
 *
 *   npx tsx scripts/chatCp4.ts --server http://127.0.0.1:3501 --plans <plans.json> --data-dir <the server's DATA_DIR>
 *     --server-log <its stdout> --yue http://127.0.0.1:8504 --yue-data <yue-server's YUE_DATA_DIR, Windows path>
 *     --out pipeline/cp-c4/<date> [--ollama http://127.0.0.1:11434 --proxy-port 11537] [--gpu] [--wsl-check]
 *     [--gpu-free-mib 4000] [--only <plan,plan>] [--append] [--note "..."]
 * plans.json: [{ "song": "<id>", "plan": "<tag>", "mix": "reharmonize+cut", "texts": ["request", "rewording", ...] }]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { gpuOnce, json, now, sleep, startGpuSampler, startOllamaProxy, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';
import { follow, thread, turnOn, type RunCtx } from './chatCp0Run.js';
import type { CheckReport } from './chatCp0EditStats.js';
import { cp4Markdown, cp4StopLines, summarizeCp4, type Cp4Apply, type Cp4Card, type Cp4Result, type StepRow } from './chatCp4Stats.js';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k: string) => process.argv.includes(`--${k}`);
const toWsl = (p: string) => path.resolve(p).replace(/^([A-Za-z]):/, (_m, d: string) => `/mnt/${d.toLowerCase()}`).replace(/\\/g, '/');
const CHECK = path.resolve(import.meta.dirname, '../../yue-server/splice_check.py');
interface PlanRow { song: string; plan: string; mix: string; texts: string[] }

const dataDir = arg('data-dir');
const db = () => new Database(path.join(dataDir, 'mulakai.db'), { readonly: true, fileMustExist: true });
function baseLayer(song: string): { layer: string; first: string; count: number } {
  const d = db();
  try {
    const layer = (d.prepare(`SELECT id FROM layers WHERE song_id = ? AND kind = 'base'`).get(song) as { id: string }).id;
    const ids = (d.prepare(`SELECT id FROM versions WHERE layer_id = ? ORDER BY created_at, rowid`).all(layer) as Array<{ id: string }>).map((r) => r.id);
    return { layer, first: ids[0], count: ids.length };
  } finally { d.close(); }
}
function versionRow(id: string): { audio: string; label: string; splice: Record<string, unknown> | null } | null {
  const d = db();
  try {
    const r = d.prepare(`SELECT audio_file, label, params_json FROM versions WHERE id = ?`).get(id) as { audio_file: string; label: string; params_json: string | null } | undefined;
    return r ? { audio: path.join(dataDir, 'audio', r.audio_file), label: r.label, splice: (JSON.parse(r.params_json ?? '{}') as { splice?: Record<string, unknown> }).splice ?? null } : null;
  } finally { d.close(); }
}
function dirBytes(dir: string): number {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? dirBytes(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
}
/** Waits (logged) until the GPU's used memory is at most `mib` for 5 s: another session's model may hold it. */
async function gpuFree(mib: number, log: (m: string) => void) {
  if (!mib) return;
  let calm = 0;
  for (let i = 0, said = false; calm < 5; i++) {
    if (gpuOnce() <= mib) calm++;
    else { calm = 0; if (!said) { log(`  waiting for the GPU (${gpuOnce()} MiB used, want <= ${mib})`); said = true; } }
    await sleep(1000);
    if (i > 3600) throw new Error('the GPU stayed busy for an hour');
  }
}

async function applyPlan(ctx: RunCtx, threadId: string, proposalId: string, song: string, tag: string, out: string, card: Cp4Card): Promise<Cp4Apply> {
  const yue = arg('yue', 'http://127.0.0.1:8504').replace(/\/+$/, '');
  const before = baseLayer(song).count;
  const a: Cp4Apply = { outcome: 'refused', editMs: null, handoffMs: null, versionsBefore: before, versionsAfter: before, versionId: null, label: null, record: null,
    fallback: null, spliceId: null, verdict: null, step: null, verdictReason: null, steps: [], nullTest: null, timing: null, tempBytes: null, audioLeft: null, check: null };
  const press = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/apply`, { proposalId });
  if (post.status !== 202) return { ...a, reason: `${post.status} ${JSON.stringify(post.body)}` };
  const jobId = (post.body as { jobId: string }).jobId;
  let phase = '';
  const f = await follow(ctx, jobId, Number(arg('apply-timeout', '1200')) * 1000, (j) => {
    const s = `${j.status} ${j.progressText ?? ''} ${j.progressStage ?? ''}`.trim();
    if (s !== phase) { phase = s; ctx.log(`  apply ${tag}: ${s} (+${((now() - press) / 1000).toFixed(1)} s)`); }
  });
  Object.assign(a, { outcome: f.timedOut ? 'timeout' : f.last?.status === 'done' ? 'saved' : 'failed', reason: f.last?.error ? String(f.last.error) : undefined,
    handoffMs: f.runningAt === null ? null : f.runningAt - press, editMs: f.endAt - press });
  for (let i = 0; a.outcome === 'saved' && i < 50 && !a.versionId; i++) {
    const m = (await thread(ctx, threadId)).messages.find((x) => x.kind === 'version' && x.jobId === jobId) as { versionId?: string } | undefined;
    if (m?.versionId) a.versionId = m.versionId; else await sleep(100);
  }
  a.versionsAfter = baseLayer(song).count;
  const saved = a.versionId ? versionRow(a.versionId) : null;
  Object.assign(a, { label: saved?.label ?? null, record: saved?.splice ?? null, fallback: (saved?.splice?.fallback as string | undefined) ?? null });
  const log = fs.existsSync(arg('server-log')) ? fs.readFileSync(arg('server-log'), 'utf8') : '';
  a.spliceId = new RegExp(`chat edit ${jobId}: splice (\\S+) on`).exec(log)?.[1] ?? null;
  if (!a.spliceId) return a;
  const rec = await json('GET', `${yue}/v1/splices/${a.spliceId}`);
  const resultFile = path.join(out, 'splices', `${tag}.json`);
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify(rec.body, null, 1));
  const r = (rec.body as { result?: Record<string, any> } | null)?.result;
  const jobDir = path.join(arg('yue-data'), 'splices', a.spliceId);
  const dir = [jobDir, path.join(arg('yue-data'), a.spliceId)].find((p) => fs.existsSync(p));
  Object.assign(a, { tempBytes: dir ? dirBytes(dir) : 0, audioLeft: dir ? fs.existsSync(path.join(dir, 'audio.wav')) : false });
  if (!r) return a;
  Object.assign(a, {
    verdict: r.verdict ?? null, step: r.step ?? null, verdictReason: [r.reason, r.detail].filter(Boolean).join(': ') || null, nullTest: r.null_test ?? null, timing: r.timing ?? null,
    steps: ((r.steps ?? []) as Array<Record<string, any>>).map((s): StepRow => ({ kind: s.kind, bars: s.bars ?? null, verdict: s.verdict ?? null,
      reason: [s.reason, s.detail].filter(Boolean).join(': ') || null, snap_ms: (s.snap ?? []).map((x: { delta_ms: number }) => x.delta_ms), gain_db: s.gain_db ?? null,
      joins_s: s.joins_s ?? [], length_diff_s: s.length_diff_s ?? null, null_test: s.null_test ?? null })),
  });
  const base = versionRow(baseLayer(song).first)?.audio;
  if (flag('wsl-check') && r.verdict === 'ok' && saved && base) {
    const cmd = `cd ${toWsl(path.dirname(CHECK))} && ~/yue2/.venv/bin/python splice_check.py --chain '${toWsl(base)}' '${toWsl(saved.audio)}' '${toWsl(resultFile)}'`;
    const run = spawnSync('wsl.exe', ['-d', 'Ubuntu-24.04', '--exec', 'bash', '-lc', cmd], { encoding: 'utf8', timeout: 600_000 });
    try { a.check = JSON.parse(run.stdout) as CheckReport; } catch { a.checkError = `exit ${run.status}: ${(run.stderr || run.stdout || '').slice(-300)}`; }
  }
  return a;
}

async function runPlan(ctx: RunCtx, p: PlanRow, index: number, out: string): Promise<Cp4Result> {
  const t = await json('GET', `${ctx.server}/api/chat/songs/${p.song}/thread`);
  if (t.status !== 200) throw new Error(`OPEN ${p.song}: ${t.status} ${JSON.stringify(t.body)}`);
  const threadId = (t.body as { id: string }).id;
  const title = String((await json('GET', `${ctx.server}/api/songs/${p.song}`)).body?.title ?? p.song.slice(0, 8));
  await json('PATCH', `${ctx.server}/api/layers/versions/${baseLayer(p.song).first}/activate`); // every plan edits the base
  const res: Cp4Result = { song: p.song, title, plan: p.plan, mix: p.mix, texts: [], turn: null, ops: 0, card: null, apply: null };
  let proposalId: string | null = null;
  // a turn that failed (planner timeout while another session held the GPU) is sent again with the same words, twice at most
  const tries = p.texts.flatMap((text) => [text, text, text]);
  for (let k = 0, failed = false; k < tries.length; k++) {
    const text = tries[k];
    if (k % 3 && !failed) continue;
    await gpuFree(Number(arg('gpu-free-mib', '0')), ctx.log);
    const { result, reply } = await turnOn(ctx, threadId, { index: index * 10 + k, id: `${p.plan}-${k}`, lang: 'en', expect: 'edit' }, text);
    const body = reply?.kind === 'edit' ? (reply.body as { ops?: unknown[]; splice?: Cp4Card } | null) : null;
    Object.assign(res, { texts: [...res.texts, text], turn: result, ops: body?.ops?.length ?? 0, card: body?.splice ?? null });
    ctx.log(`${title} ${p.plan} try ${k + 1}: ${result.action ?? 'no reply'} in ${((result.turnMs ?? 0) / 1000).toFixed(1)} s, ${res.ops} ops, ${body ? JSON.stringify(body.splice) : (reply?.text ?? result.reasons[0] ?? '').slice(0, 200)}`);
    if (body && res.ops >= 2) { proposalId = reply?.proposalId ?? null; break; }
    failed = !reply || reply.kind === 'failed' || result.action === 'timeout';
  }
  if (!proposalId || !res.card) return res;
  await gpuFree(Number(arg('gpu-free-mib', '0')), ctx.log);
  res.apply = await applyPlan(ctx, threadId, proposalId, p.song, `${p.song.slice(0, 8)}-${p.plan}`, out, res.card);
  const a = res.apply;
  ctx.log(`${title} ${p.plan}: APPLY ${a.outcome}${a.reason ? ` (${a.reason})` : ''}, ${((a.editMs ?? 0) / 1000).toFixed(1)} s, versions ${a.versionsBefore} -> ${a.versionsAfter}, "${a.label ?? ''}", verdict ${a.verdict ?? '-'}${a.step ? ` at step ${a.step}` : ''} ${a.verdictReason ?? ''}, saved-file null ${a.check ? `${a.check.null_test.different}/${a.check.null_test.samples}` : a.checkError ?? '-'}`);
  return res;
}

async function main() {
  const server = arg('server', 'http://127.0.0.1:3501').replace(/\/+$/, '');
  const out = arg('out');
  if (!out || !dataDir || !arg('plans') || !arg('server-log') || !arg('yue-data')) throw new Error('need --out, --plans, --data-dir, --server-log and --yue-data');
  const only = arg('only').split(',').filter(Boolean);
  const plans = (JSON.parse(fs.readFileSync(arg('plans'), 'utf8')) as PlanRow[]).filter((p) => !only.length || only.includes(p.plan));
  fs.mkdirSync(out, { recursive: true });
  const logFile = fs.createWriteStream(path.join(out, 'run.log'), { flags: 'a' });
  const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
  const events: ProxyEvent[] = [];
  const gpu: GpuSample[] = [];
  const ctx: RunCtx = { server, proxied: Boolean(arg('ollama')), events, gpu, log, turnTimeoutMs: 600_000, takeTimeoutMs: 0 };
  const proxy = arg('ollama') ? await startOllamaProxy(Number(arg('proxy-port', '11537')), arg('ollama').replace(/\/+$/, ''), events) : null;
  const sampler = flag('gpu') ? startGpuSampler(path.join(out, 'nvidia-smi.csv'), gpu) : null;
  // --append: keep the plans an earlier run already recorded in <out>/results.json (a run cut short)
  const prior = path.join(out, 'results.json');
  const results: Cp4Result[] = flag('append') && fs.existsSync(prior) ? (JSON.parse(fs.readFileSync(prior, 'utf8')) as { results: Cp4Result[] }).results : [];
  const started = new Date().toISOString();
  const save = () => {
    const summary = summarizeCp4(results);
    const meta = { server, started, date: started.slice(0, 10), note: arg('note') };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ meta, summary, stopLines: cp4StopLines(summary), results, proxyEvents: events }, null, 1));
    fs.writeFileSync(path.join(out, 'summary.md'), cp4Markdown(summary, results, { server, date: meta.date, note: meta.note }));
    return cp4StopLines(summary);
  };
  try {
    const status = await json('GET', `${server}/api/chat/status`);
    log(`CP-C4 start: ${server}, ${plans.length} plans, status ${JSON.stringify(status.body)}`);
    for (const [i, p] of plans.entries()) { results.push(await runPlan(ctx, p, i, out)); save(); }
  } finally {
    for (const song of new Set(plans.map((p) => p.song))) await json('PATCH', `${server}/api/layers/versions/${baseLayer(song).first}/activate`).catch(() => null);
    const lines = save();
    sampler?.kill(); proxy?.close(); logFile.end();
    for (const l of lines) console.log(`${l.verdict.padEnd(7)} ${l.text}`);
    if (lines.some((l) => l.verdict === 'STOP')) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(`CP-C4 error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
