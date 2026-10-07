/**
 * CP-C1, the version analysis and marked turns on the real machine (scope.md CL-6; architecture.md "Test strategy
 * (C1)" #9; R-031, R-032, D-188). Over the HTTP API, per YuE2 library song: OPEN its thread (the analysis of v1
 * starts) -> an edit turn after it (planner on the GPU? turn time) -> APPLY, with a second turn sent during the
 * render (it runs before v2's analysis) -> APPLY that card while v2's analysis runs (refused? its wait) -> a marked
 * turn sent at once after v3 saves (queued behind v3's analysis) -> more marked turns (10 in all: 5 one-section,
 * 3 across two sections, 2 seconds only; ops judged against the mark). Per transcribed song: OPEN -> the analysis
 * (Q-070's section names) -> a turn after it. nvidia-smi, Ollama /api/ps and the planner proxy sampled throughout.
 * Evidence: <out>/results.json, summary.md, run.log, nvidia-smi.csv. Exit 1 on any STOP.
 *
 *   npx tsx scripts/chatCp1.ts --server http://127.0.0.1:3221 --out <dir> --ollama http://127.0.0.1:11535 --data <DATA_DIR>
 *     --yue2 <id>,<id>,<id> --trans <id>,<id>,<id> [--proxy-port 11536] [--owner http://127.0.0.1:3001]
 *     [--merge --marks "<song>:<one|cross|secs>@<section pick>/<text index>,...;..."] (more marked turns, added to results.json)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startPsSampler } from './chatCp3Run.js';
import type { PsSample } from './chatCp3Stats.js';
import { buildMark, factsOf, findAnalysis, finishTurn, followApply, pressApply, sendTurn, view, watchAnalysis, type Ctx, type MarkKind } from './chatCp1Run.js';
import { stopLines, summarize, summaryMarkdown, type AnalysisRecord, type Run, type TurnRecord } from './chatCp1Stats.js';
import { gpuOnce, json, sleep, startGpuSampler, startOllamaProxy, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const EDIT1 = 'give the first chorus jazz chords';
const EDIT2 = 'now make the last chorus calmer, with softer chords';
const MARKS: MarkKind[][] = [['one', 'one', 'cross', 'secs'], ['one', 'one', 'cross', 'secs'], ['one', 'cross']];
const TEXT: Record<MarkKind, string[]> = {
  one: ['give this part jazz chords', 'make this part darker, with minor chords', 'rewrite the lyrics of this part about the sea', 'repeat this part once more', 'make this calmer, with softer chords'],
  cross: ['give this passage jazz chords', 'make this stretch brighter', 'rewrite these lines about rain'],
  secs: ['give this bit jazz chords', 'make this sadder'],
};
const used: Record<MarkKind, number> = { one: 0, cross: 0, secs: 0 };

/** The card idle (util under 15 % three samples running) and the owner's app running no job. */
async function gpuIdle(owner: string, log: (m: string) => void) {
  for (let i = 0, calm = 0; i < 1200; i++) {
    const util = Number(execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']).toString().trim());
    const active = (await json('GET', `${owner}/api/generate/active`, undefined, 3000).catch(() => ({ body: null }))).body?.active ?? null;
    calm = util < 15 && !active ? calm + 1 : 0;
    if (calm >= 3) return;
    if (i % 30 === 0) log(`  waiting for the GPU: util ${util} %, owner job ${active ? 'yes' : 'none'}`);
    await sleep(1000);
  }
  throw new Error('the GPU stayed busy for 20 min');
}

async function main() {
  const out = arg('out'); const dataDir = arg('data');
  if (!out || !dataDir) throw new Error('need --out <dir> and --data <the server DATA_DIR>');
  fs.mkdirSync(out, { recursive: true });
  const server = arg('server', 'http://127.0.0.1:3221').replace(/\/+$/, ''); const ollama = arg('ollama', 'http://127.0.0.1:11535').replace(/\/+$/, '');
  const owner = arg('owner', 'http://127.0.0.1:3001');
  const logFile = fs.createWriteStream(path.join(out, 'run.log'), { flags: 'a' });
  const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
  const events: ProxyEvent[] = []; const gpu: GpuSample[] = []; const ps: PsSample[] = [];
  const ctx: Ctx = { server, dataDir, proxied: true, events, gpu, ps, log, turnTimeoutMs: 300_000, readTimeoutMs: 900_000, takeTimeoutMs: 1_200_000 };
  const proxy = await startOllamaProxy(Number(arg('proxy-port', '11536')), ollama, events);
  const prior = process.argv.includes('--merge') && fs.existsSync(path.join(out, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')) as Run & { meta: unknown; proxyEvents: ProxyEvent[]; ollamaPs: PsSample[] } : null;
  const sampler = startGpuSampler(path.join(out, prior ? `nvidia-smi.${Date.now()}.csv` : 'nvidia-smi.csv'), gpu);
  const stopPs = startPsSampler(ollama, ps);
  // a turn that asked for a mark the strip could not give (hatched) was sent without one: not a marked turn
  const run: Run = { analyses: prior?.analyses ?? [], turns: (prior?.turns ?? []).map((t) => (t.role === 'marked' && !t.mark ? { ...t, role: 'no-mark' } : t)), applies: prior?.applies ?? [] };
  const started = new Date().toISOString();
  const save = () => {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ meta: { server, started, idleMiB: gpu[0]?.mib ?? null }, summary: summarize(run), stopLines: stopLines(summarize(run)), ...run, priorMeta: prior?.meta ?? null, proxyEvents: [...(prior?.proxyEvents ?? []), ...events], ollamaPs: [...(prior?.ollamaPs ?? []), ...ps] }, null, 1));
    fs.writeFileSync(path.join(out, 'summary.md'), summaryMarkdown(run, { server, date: started.slice(0, 10), note: `Planner via the proxy to ${ollama} (own Ollama, ctx 16384). GPU at start ${gpu[0]?.mib ?? '-'} MiB. ${arg('note')}` }));
  };
  const open = async (song: string, source: AnalysisRecord['source']) => {
    const t = await json('GET', `${server}/api/chat/songs/${song}/thread`);
    if (t.status !== 200) throw new Error(`OPEN ${song}: ${t.status}`);
    const title = String((await json('GET', `${server}/api/songs/${song}`)).body?.title ?? (await json('GET', `${server}/api/songs/${song}`)).body?.song?.title ?? song.slice(0, 8));
    const job = await findAnalysis(ctx, song);
    if (job) run.analyses.push(await watchAnalysis(ctx, { song, title, source, trigger: 'open', jobId: job }));
    else log(`  ${title}: no analysis started on OPEN (${JSON.stringify((await view(ctx, song)).state)})`);
    return { threadId: t.body.id as string, title, lastJob: job };
  };
  const turn = async (song: string, threadId: string, id: string, role: TurnRecord['role'], afterAnalysis: boolean, text: string, kind?: MarkKind, pick = 0) => {
    const v = await view(ctx, song);
    const mark = kind ? buildMark(v, kind, pick) : null;
    if (kind && !mark) { log(`  ${id}: no mark could be built (${v.shown?.mode ?? 'no reading'}); sent without one`); role = 'no-mark'; }
    const sent = await sendTurn(ctx, threadId, text, mark);
    return { sent, done: () => finishTurn(ctx, threadId, sent, { song, id, role, afterAnalysis, text }, v.shown?.bars?.starts ?? null).then((r) => { run.turns.push(r.rec); save(); return r; }) };
  };
  try {
    log(`CP-C1 start: ${server}, status ${JSON.stringify((await json('GET', `${server}/api/chat/status`)).body)}, GPU ${gpuOnce()} MiB`);
    const yue2 = arg('yue2').split(',').filter(Boolean);
    for (const [k, song] of yue2.entries()) {
      await gpuIdle(owner, log);
      const { threadId, title, lastJob } = await open(song, 'yue2');
      log(`${title} (${song}): thread ${threadId}`); save();
      const t1 = await (await turn(song, threadId, `${k}-T1`, 'after-analysis', true, EDIT1)).done();
      let a1Job = lastJob; const marksLeft = [...MARKS[k % MARKS.length]]; let mi = 1;
      if (t1.proposalId) {
        const p1 = await pressApply(ctx, threadId, t1.proposalId);
        const t2 = await turn(song, threadId, `${k}-T2`, 'behind-apply', false, EDIT2);
        const ap1 = await followApply(ctx, threadId, p1, `${k}-apply1`);
        run.applies.push({ song, tag: `${k}-apply1`, behind: 'none', analysisJob: null, postStatus: p1.status, reason: p1.reason ?? ap1.reason, waitMs: ap1.waitMs, startedAfterAnalysisMs: null, outcome: ap1.outcome, editMs: ap1.editMs, versionId: ap1.versionId });
        a1Job = ap1.outcome === 'saved' ? await findAnalysis(ctx, song, lastJob) : null;
        const a1P = a1Job ? watchAnalysis(ctx, { song, title, source: 'yue2', trigger: 'save', jobId: a1Job }) : null;
        const t2r = await t2.done();
        let a1: AnalysisRecord | null;
        if (t2r.proposalId) {
          const st = (await view(ctx, song)).state;
          const behind = st.kind === 'running' ? 'running' : st.kind === 'queued' ? 'queued' : 'none';
          log(`  APPLY 2 pressed while the analysis is ${st.kind}`);
          const p2 = await pressApply(ctx, threadId, t2r.proposalId);
          const ap2P = followApply(ctx, threadId, p2, `${k}-apply2`);
          a1 = a1P ? await a1P : null;
          if (a1) run.analyses.push(a1);
          const ap2 = await ap2P;
          run.applies.push({ song, tag: `${k}-apply2`, behind, analysisJob: a1Job, postStatus: p2.status, reason: p2.reason ?? ap2.reason, waitMs: ap2.waitMs, startedAfterAnalysisMs: ap2.runningAt && a1?.endAt ? ap2.runningAt - a1.endAt : null, outcome: ap2.outcome, editMs: ap2.editMs, versionId: ap2.versionId });
          const a2Job = ap2.outcome === 'saved' ? await findAnalysis(ctx, song, a1Job) : null;
          const a2P = a2Job ? watchAnalysis(ctx, { song, title, source: 'yue2', trigger: 'save', jobId: a2Job }) : null;
          const kind = marksLeft.shift()!;
          const m1 = await turn(song, threadId, `${k}-M${mi++}`, 'marked', true, TEXT[kind][used[kind]++], kind, 0); // queued behind v3's analysis (R-032)
          if (a2P) run.analyses.push(await a2P);
          await m1.done();
        } else if (a1P) run.analyses.push(await a1P);
        save();
      }
      for (const [i, kind] of marksLeft.entries()) {
        const m = await turn(song, threadId, `${k}-M${mi++}`, 'marked', false, TEXT[kind][used[kind]++], kind, i + 1);
        await m.done();
      }
      const facts = factsOf(ctx, song);
      log(`${title}: done; score sections ${facts ? facts.sections.map((s: { label: string }) => s.label).join(' ') : '-'}`);
    }
    for (const spec of arg('marks').split(';').filter(Boolean)) { // <song>:<kind>@<pick>/<text index>,...: more marked turns on an analyzed song
      const [song, list] = spec.split(':');
      const t = await json('GET', `${server}/api/chat/songs/${song}/thread`);
      for (const item of list.split(',')) {
        const [, kind, pick, ti] = /^(one|cross|secs)@(\d+)\/(\d+)$/.exec(item) ?? [];
        if (!kind) throw new Error(`--marks item ${item}: want <kind>@<pick>/<text index>`);
        await (await turn(song, t.body.id, `x-${song.slice(0, 4)}-${item}`, 'marked', false, TEXT[kind as MarkKind][Number(ti)], kind as MarkKind, Number(pick))).done();
      }
    }
    for (const [k, song] of arg('trans').split(',').filter(Boolean).entries()) {
      await gpuIdle(owner, log);
      const { threadId, title } = await open(song, 'transcribed');
      await (await turn(song, threadId, `tr${k}-T1`, 'after-analysis', true, 'which sections does this song have, and where does each start?')).done();
      log(`${title}: done`);
    }
  } finally {
    save();
    sampler.kill(); stopPs(); proxy.close(); logFile.end();
    for (const l of stopLines(summarize(run))) console.log(`${l.verdict.padEnd(7)} ${l.text}`);
    if (stopLines(summarize(run)).some((l) => l.verdict === 'STOP')) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(`CP-C1 error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
