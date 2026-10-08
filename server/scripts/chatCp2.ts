/**
 * CP-C2, REVISE as a follow-up chat turn on the real machine (scope.md CV-5; architecture.md "Test strategy (C2)" #7;
 * R-040, D-227). Over the HTTP API, per YuE2 library song: OPEN its thread (the analysis it starts is waited for, so a
 * chorus can be marked) -> a fresh edit plan -> a chain of revise turns on the live card: additive, under a mark
 * ("do the same here" on chorus 2), fewer, a lyric rewrite added, over 6 ops, a replacement, additive again. Per turn:
 * the planner's prompt tokens (recording proxy), context refusals, the pending ops (the live card before) against the
 * card after (merged ops, CHANGED from, REMOVED; judged by value in chatCp2Stats), attempts, the outcome. No APPLY.
 * Evidence: <out>/turns.jsonl, proxy.jsonl, run.log, nvidia-smi.csv, summary.md. Exit 1 on any STOP.
 *
 *   npx tsx scripts/chatCp2.ts --server http://127.0.0.1:3231 --out <dir> --ollama http://127.0.0.1:11555 --data <DATA_DIR>
 *     --songs <id>,<id>,<id> [--proxy-port 11556] [--owner http://127.0.0.1:3001]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { follow, thread, type Msg } from './chatCp0Run.js';
import { plannerWindow } from './chatCp0Stats.js';
import { findAnalysis, sendTurn, view, watchAnalysis, type Ctx, type Sent, type View } from './chatCp1Run.js';
import { startPsSampler } from './chatCp3Run.js';
import type { PsSample } from './chatCp3Stats.js';
import { judgeRevise, opName, stopLines, summarize, summaryMarkdown, type Kind, type TurnRecord } from './chatCp2Stats.js';
import { gpuOnce, json, now, sleep, startGpuSampler, startOllamaProxy, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FRESH = ['slow it down to 84 BPM and give the first chorus jazz chords', 'slow it down to 84 BPM'];
const CHAIN: Array<{ kind: Kind; text: string; mark?: boolean }> = [
  { kind: 'additive', text: 'and also transpose it up a semitone' },
  { kind: 'additive', text: 'do the same here: jazz chords', mark: true },
  { kind: 'fewer', text: 'fewer chords: forget the jazz chords in the first chorus, keep the rest' },
  { kind: 'additive', text: 'also rewrite the lyrics of the second verse about the sea' },
  { kind: 'over6', text: 'and also make the style warmer with soft piano, repeat the last chorus, and add a short guitar phrase in the intro' },
  { kind: 'replace', text: 'forget all that, just transpose it down a tone' },
  { kind: 'additive', text: 'and also slow it down to 80 BPM' },
];

/** The card idle (util under 30 % three samples running), the owner's app running no job, its Ollama empty. */
async function gpuIdle(owner: string, log: (m: string) => void) {
  for (let i = 0, calm = 0; i < 1800; i++) {
    const util = Number(execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']).toString().trim());
    const active = (await json('GET', `${owner}/api/generate/active`, undefined, 3000).catch(() => ({ body: null }))).body?.active ?? null;
    const models = (await json('GET', 'http://127.0.0.1:11434/api/ps', undefined, 3000).catch(() => ({ body: null }))).body?.models ?? [];
    calm = util < 30 && !active && !models.length ? calm + 1 : 0;
    if (calm >= 3) return;
    if (i % 30 === 0) log(`  waiting for the GPU: util ${util} %, owner job ${active ? 'yes' : 'none'}, owner Ollama ${models.length} models`);
    await sleep(1000);
  }
  throw new Error('the GPU stayed busy for 30 min');
}

/** A range mark on the 2nd chorus (else the last chorus or verse) as the strip would send it. */
function chorusMark(v: View): Sent['mark'] {
  const sh = v.shown;
  if (!sh?.bars || !v.versionId) return null;
  const { starts, end } = sh.bars;
  const held = sh.sections.filter((s) => s.bars[1] <= starts.length);
  const s = held.find((x) => /chorus/i.test(x.label) && x.occurrence === 2) ?? [...held].reverse().find((x) => /chorus|verse/i.test(x.label));
  if (!s) return null;
  return { kind: 'range', versionId: v.versionId, bars: s.bars, seconds: [starts[s.bars[0] - 1], s.bars[1] < starts.length ? starts[s.bars[1]] : end] };
}

const replyAfter = (msgs: Msg[], id: string | null) => msgs.slice(msgs.findIndex((m) => m.id === id) + 1).find((m) => m.role === 'assistant' && m.kind !== 'song' && m.kind !== 'version') ?? null;
const lastCard = (msgs: Msg[]) => [...msgs].reverse().find((m) => m.kind === 'edit') ?? null;

async function main() {
  const out = arg('out'); const dataDir = arg('data'); const songs = arg('songs').split(',').filter(Boolean);
  if (!out || !dataDir || !songs.length) throw new Error('need --out <dir>, --data <the server DATA_DIR> and --songs <ids>');
  fs.mkdirSync(out, { recursive: true });
  const server = arg('server', 'http://127.0.0.1:3231').replace(/\/+$/, ''); const ollama = arg('ollama', 'http://127.0.0.1:11555').replace(/\/+$/, '');
  const owner = arg('owner', 'http://127.0.0.1:3001');
  const logFile = fs.createWriteStream(path.join(out, 'run.log'), { flags: 'a' });
  const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
  const events: ProxyEvent[] = []; const gpu: GpuSample[] = []; const ps: PsSample[] = [];
  const ctx: Ctx = { server, dataDir, proxied: true, events, gpu, ps, log, turnTimeoutMs: 420_000, readTimeoutMs: 900_000, takeTimeoutMs: 0 };
  const proxy = await startOllamaProxy(Number(arg('proxy-port', '11556')), ollama, events);
  const sampler = startGpuSampler(path.join(out, 'nvidia-smi.csv'), gpu);
  const stopPs = startPsSampler(ollama, ps);
  const turns: TurnRecord[] = [];
  const started = new Date().toISOString();
  const save = () => fs.writeFileSync(path.join(out, 'summary.md'), summaryMarkdown(turns, { date: started.slice(0, 10), note: `Server ${server}; planner via the recording proxy to ${ollama} (own Ollama, ctx 16384). GPU at start ${gpu[0]?.mib ?? '-'} MiB. Pending ops = the live edit card before the turn; judged by value against the card after.` }));
  const turn = async (song: string, threadId: string, id: string, kind: Kind, text: string, marked: boolean): Promise<TurnRecord> => {
    await gpuIdle(owner, log);
    const before = lastCard((await thread(ctx, threadId)).messages);
    const pending = kind === 'fresh' ? null : ((before?.body?.ops ?? null) as Array<Record<string, unknown>> | null);
    const mark = marked ? chorusMark(await view(ctx, song)) : null;
    if (marked && !mark) log(`  ${id}: no chorus mark could be built; sent without one`);
    const s = await sendTurn(ctx, threadId, text, mark);
    const rec: TurnRecord = { song, id, kind, text, marked: Boolean(mark), postStatus: s.status, outcome: 'refused', reasons: s.reason ? [s.reason] : [], attempts: null,
      pendingOps: pending?.length ?? null, mergedOps: null, judge: null, promptTokens: [], contextRefused: false, runMs: null, revise: Boolean(pending) };
    let replies: unknown[] = [];
    if (s.jobId) {
      const f = await follow(ctx, s.jobId, ctx.turnTimeoutMs);
      await sleep(300);
      const reply = replyAfter((await thread(ctx, threadId)).messages, s.messageId);
      const body = (reply?.body ?? {}) as { ops?: Array<Record<string, unknown>>; since?: Parameters<typeof judgeRevise>[1]['since']; reasons?: string[]; cause?: string; attempts?: number };
      const start = f.runningAt ?? s.t0; const win = plannerWindow(events, start, f.endAt);
      replies = events.filter((e) => e.t0 >= start - 50 && e.t1 <= f.endAt + 50 && e.path.startsWith('/v1/chat')).map((e) => e.info.content);
      Object.assign(rec, {
        outcome: reply?.kind ?? (f.timedOut ? 'timeout' : String(f.last?.status ?? 'gone')), runMs: f.endAt - start, promptTokens: win.promptTokens,
        reasons: body.reasons ?? (body.cause ? [body.cause] : f.last?.error ? [String(f.last.error)] : reply && reply.kind !== 'edit' ? [reply.text.slice(0, 300)] : []),
        attempts: body.attempts ?? win.calls, mergedOps: reply?.kind === 'edit' ? body.ops?.length ?? 0 : null,
        judge: reply?.kind === 'edit' && pending ? judgeRevise(pending, { ops: body.ops ?? [], since: body.since ?? null }) : null,
      });
      rec.contextRefused = [...rec.reasons, String(f.last?.error ?? '')].some((r) => /planner context|cut prompt/i.test(r));
      if (reply?.kind === 'edit') log(`    card ops ${(body.ops ?? []).map(opName).join(', ')}; since ${body.since ? `${body.since.marks.map((m) => m.mark).join(' ')} REMOVED ${body.since.removed.map(opName).join(', ') || '-'}` : 'none'}`);
    }
    log(`  turn ${id} (${kind}${rec.marked ? ', marked' : ''}): ${rec.outcome} run ${((rec.runMs ?? 0) / 1000).toFixed(1)} s, tokens ${JSON.stringify(rec.promptTokens)}, pending ${rec.pendingOps ?? '-'} -> ${rec.mergedOps ?? '-'} ${rec.judge ? JSON.stringify(rec.judge) : ''} ${rec.reasons[0]?.slice(0, 200) ?? ''}`);
    fs.appendFileSync(path.join(out, 'turns.jsonl'), JSON.stringify({ ...rec, at: new Date().toISOString(), pending, mark, plannerReplies: replies }) + '\n');
    turns.push(rec); save();
    return rec;
  };
  try {
    log(`CP-C2 start: ${server}, status ${JSON.stringify((await json('GET', `${server}/api/chat/status`)).body)}, GPU ${gpuOnce()} MiB`);
    for (const [k, song] of songs.entries()) {
      await gpuIdle(owner, log);
      const t = await json('GET', `${server}/api/chat/songs/${song}/thread`);
      if (t.status !== 200) throw new Error(`OPEN ${song}: ${t.status}`);
      const threadId = t.body.id as string;
      const job = await findAnalysis(ctx, song);
      if (job) await watchAnalysis(ctx, { song, title: song.slice(0, 8), source: 'yue2', trigger: 'open', jobId: job });
      const sh = (await view(ctx, song)).shown;
      log(`song ${k} ${song}: thread ${threadId}, strip ${sh?.mode ?? 'none'}, sections ${(sh?.sections ?? []).map((x) => `${x.label}${x.occurrence > 1 ? x.occurrence : ''} ${x.bars[0]}-${x.bars[1]}`).join(', ')}`);
      let card = false;
      for (const [i, text] of FRESH.entries()) {
        if ((await turn(song, threadId, `${k}-F${i}`, 'fresh', text, false)).outcome === 'edit') { card = true; break; }
      }
      if (!card) { log(`  ${song}: no fresh plan, chain skipped`); continue; }
      for (const [i, step] of CHAIN.entries()) await turn(song, threadId, `${k}-R${i + 1}`, step.kind, step.text, Boolean(step.mark));
    }
  } finally {
    save();
    fs.writeFileSync(path.join(out, 'proxy.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
    sampler.kill(); stopPs(); proxy.close(); logFile.end();
    for (const l of stopLines(summarize(turns))) console.log(`${l.verdict.padEnd(7)} ${l.text}`);
    if (stopLines(summarize(turns)).some((l) => l.verdict === 'STOP')) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(`CP-C2 error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
