/**
 * CP-C0a, create leg (scope.md CA-4, F-050 #1; architecture.md test strategy 8): a fixed set of describe
 * prompts through the server's HTTP chat API, one fresh draft thread each (NEW CHAT -> SEND -> wait),
 * recording the reply's action, attempts, turn time and prompt tokens; with `--create N`, CREATE SONG on
 * the first N recipe cards and the take followed until saved. Evidence: <out>/results.json + summary.md;
 * the scope's stop lines printed as PASS / STOP (exit code 1 on any STOP).
 *
 * Planner timings need the recording proxy (scoreCp1Lib): pass `--ollama <real Ollama>` and start the
 * server with LLM_API_URL=http://127.0.0.1:<--proxy-port>. Without `--ollama`, attempts come from the
 * job's "attempt n of 3" line and there are no prompt tokens or unload times. Never point it at the live
 * library with `--create`: run the server on a copy of server/data (D-040).
 *
 *   npx tsx scripts/chatCp0.ts --server http://127.0.0.1:3201 --out <dir> [--ollama http://127.0.0.1:11434
 *     --proxy-port 11436] [--create 1] [--gpu] [--limit 10]
 *
 * `--leg edit` (CP-C0, CB-4): the edit leg on library songs (chatCp0Edit.ts; stop lines in chatCp0EditStats.ts):
 *   npx tsx scripts/chatCp0.ts --leg edit --songs <id,id,id> --data-dir <the server's DATA_DIR> --server-log <its stdout>
 *     --yue http://127.0.0.1:8004 --out <dir> [--listen <dir>] [--wsl-check] [--ollama ... --proxy-port ...] [--gpu]
 */
import fs from 'node:fs';
import path from 'node:path';
import { json, sleep, startGpuSampler, startOllamaProxy, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';
import { runCreate, runTurn, type Prompt, type RunCtx } from './chatCp0Run.js';
import { stopLines, summarize, summaryMarkdown, type StopLine, type TurnResult } from './chatCp0Stats.js';
import { runEditLeg } from './chatCp0Edit.js';
import { editMarkdown, editStopLines, summarizeEdits, type EditResult } from './chatCp0EditStats.js';

/** 10 descriptions: EN / DE / ES, 3 vague ones that should get an `ask` (architecture.md 8). */
const PROMPTS: Prompt[] = [
  { id: 'en-sea-ballad', lang: 'en', expect: 'recipe', text: 'a slow Spanish ballad about the sea, nylon guitar, soft female voice' },
  { id: 'de-abschied', lang: 'de', expect: 'recipe', text: 'Schreib mir einen langsamen deutschen Popsong über den Abschied, mit Klavier und weicher Frauenstimme' },
  { id: 'es-cumbia', lang: 'es', expect: 'recipe', text: 'Escríbeme una cumbia alegre sobre el verano en la ciudad, con acordeón y voz masculina, letra en español' },
  { id: 'en-vague-song', lang: 'en', expect: 'ask', text: 'make me a song' },
  { id: 'en-synthpop', lang: 'en', expect: 'recipe', text: 'an upbeat synth-pop song about driving at night, 120 BPM, male vocals, English lyrics' },
  { id: 'de-vague', lang: 'de', expect: 'ask', text: 'Mach mal was Schönes' },
  { id: 'en-waltz', lang: 'en', expect: 'recipe', text: 'a 6/8 folk waltz in D major about an old lighthouse keeper, fiddle and acoustic guitar' },
  { id: 'es-lluvia', lang: 'es', expect: 'recipe', text: 'Una balada lenta en español sobre la lluvia, piano y voz femenina suave, en re menor' },
  { id: 'en-vague-nice', lang: 'en', expect: 'ask', text: 'something nice' },
  { id: 'de-rock', lang: 'de', expect: 'recipe', text: 'Ein deutscher Rocksong über Freundschaft, 140 BPM, E-Gitarren, rauer Männergesang, deutscher Text' },
];

const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k: string) => process.argv.includes(`--${k}`);

async function main() {
  const server = arg('server', 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const out = arg('out');
  if (!out) throw new Error('need --out <dir> (pipeline/cp-c0/<date>/)');
  const ollama = arg('ollama');
  const proxyPort = Number(arg('proxy-port', '11436'));
  const createN = Number(arg('create', '0'));
  const prompts = PROMPTS.slice(0, Number(arg('limit', String(PROMPTS.length))));
  fs.mkdirSync(out, { recursive: true });
  const logFile = fs.createWriteStream(path.join(out, 'run.log'), { flags: 'a' });
  const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
  const events: ProxyEvent[] = [];
  const gpu: GpuSample[] = [];
  const ctx: RunCtx = {
    server, proxied: Boolean(ollama), events, gpu, log,
    turnTimeoutMs: Number(arg('turn-timeout', '300')) * 1000, takeTimeoutMs: Number(arg('take-timeout', '1800')) * 1000,
  };
  const proxy = ollama ? await startOllamaProxy(proxyPort, ollama.replace(/\/+$/, ''), events) : null;
  const sampler = flag('gpu') ? startGpuSampler(path.join(out, 'nvidia-smi.csv'), gpu) : null;
  const results: TurnResult[] = [];
  const edits: EditResult[] = [];
  const edit = arg('leg', 'create') === 'edit';
  const started = new Date().toISOString();
  const save = (): StopLine[] => {
    const meta = { server, started, date: started.slice(0, 10), proxy: ollama ? `127.0.0.1:${proxyPort} -> ${ollama}` : null, create: createN, note: arg('note') };
    const note = `${ollama ? `Planner via the proxy to ${ollama}.` : 'No proxy: no prompt tokens or unload times.'} ${meta.note}`;
    const write = (body: object, md: string) => {
      fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ...body, proxyEvents: events }, null, 1));
      fs.writeFileSync(path.join(out, 'summary.md'), md);
    };
    if (edit) {
      const summary = summarizeEdits(edits);
      write({ meta: { ...meta, leg: 'edit', songs: arg('songs') }, summary, stopLines: editStopLines(summary), edits }, editMarkdown(summary, edits, { server, date: meta.date, note }));
      return editStopLines(summary);
    }
    const summary = summarize(results);
    write({ meta, summary, stopLines: stopLines(summary), results }, summaryMarkdown(summary, results, { server, date: meta.date, note }));
    return stopLines(summary);
  };
  try {
    if (sampler) await sleep(1500);
    const status = await json('GET', `${server}/api/chat/status`);
    log(`CP-C0 ${edit ? 'edit' : 'create'} leg start: ${server}, status ${JSON.stringify(status.body)}`);
    if (status.status !== 200 || !(status.body as { configured?: boolean }).configured) throw new Error('the chat is not configured on this server (LLM_API_URL and YUE_API_URL)');
    if (edit) {
      const songs = arg('songs').split(',').filter(Boolean);
      if (!songs.length || !arg('data-dir') || !arg('server-log')) throw new Error('--leg edit needs --songs, --data-dir and --server-log');
      return await runEditLeg(ctx, {
        songs, out, dataDir: arg('data-dir'), yue: arg('yue', 'http://127.0.0.1:8004').replace(/\/+$/, ''), serverLog: arg('server-log'),
        listen: arg('listen'), wslCheck: flag('wsl-check'), applyTimeoutMs: Number(arg('apply-timeout', '900')) * 1000,
      }, (r) => { edits.push(r); save(); });
    }
    let created = 0;
    for (const [i, p] of prompts.entries()) {
      const { result, threadId, proposalId } = await runTurn(ctx, p, i);
      log(`turn ${i + 1} ${p.id}: ${result.action ?? 'no reply'}${result.cause ? ` (${result.cause}: ${result.reasons[0] ?? ''})` : ''} in ${((result.turnMs ?? 0) / 1000).toFixed(1)} s, attempts ${result.attempts ?? '-'}, calls ${result.calls ?? '-'}, prompt tokens ${result.promptTokens.join('/') || '-'}, unload ${result.unloadMs ?? '-'} ms`);
      results.push(result);
      if (proposalId && created < createN) {
        created++;
        result.create = await runCreate(ctx, threadId, proposalId);
        log(`CREATE SONG ${p.id}: ${result.create.outcome}${result.create.reason ? ` (${result.create.reason})` : ''}, hand-off ${result.create.handoffMs ?? '-'} ms, take ${((result.create.takeMs ?? 0) / 1000).toFixed(1)} s, song ${result.create.songId ?? '-'}, ${result.create.seconds ?? '-'} s audio`);
      }
      save();
    }
  } finally {
    const lines = save();
    sampler?.kill(); proxy?.close(); logFile.end();
    for (const l of lines) console.log(`${l.verdict.padEnd(7)} ${l.text}`);
    if (lines.some((l) => l.verdict === 'STOP')) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(`CP-C0a error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
