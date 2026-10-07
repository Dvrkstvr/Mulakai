/**
 * CP-C3, reference songs on the real machine (scope.md CR-8; architecture.md "Test strategy (C3)" 6;
 * D-153: 3 library songs, 1 YuE2 + 2 ACE-Step, while the owner's recordings are not in). Per reference,
 * over the HTTP API: NEW CHAT -> attach -> SEND (should answer an analyze card) -> READ -> the reading
 * (time per step) -> the follow-up turn -> `reference_use` and the borrowed / missing fields. Plus a
 * file upload (WORDS and CAPTION on their services, R-028), a non-audio file, a library song named in
 * words and more wordings (10 judged, cover vs borrow, EN / DE / ES); CREATE COVER on the legs marked
 * `create`. GPU: nvidia-smi and Ollama /api/ps sampled throughout. Evidence: <out>/results.json +
 * summary.md; stop lines printed PASS / STOP (exit 1 on any STOP). Run the server on a DATA_DIR copy
 * with LLM_API_URL=http://127.0.0.1:<--proxy-port> (D-040).
 *
 *   npx tsx scripts/chatCp3.ts --server http://127.0.0.1:3401 --out <dir> --ollama http://127.0.0.1:11434
 *     --yue2 <songId> --ace <songId>,<songId> --upload <audio file> --named-title <title> [--owner http://127.0.0.1:3001] [--only id,id] [--retry] [--merge]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runCreate } from './chatCp0Run.js';
import { ask, attach, newChat, readAndFollow, startPsSampler, type Cp3Ctx } from './chatCp3Run.js';
import { stopLines, summarize, summaryMarkdown, type Leg, type PsSample } from './chatCp3Stats.js';
import { gpuOnce, json, sleep, startGpuSampler, startOllamaProxy, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';

interface Spec { id: string; source: Leg['source']; lang: string; expect: Leg['expect']; text: string; songId?: string; file?: string; name?: string; create?: boolean }

const READ_FIRST = 'Read the attached song first.';
const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };

function specs(yue2: string, ace: string[], upload: string, txt: string): Spec[] {
  const y = (id: string, lang: string, expect: Leg['expect'], text: string): Spec => ({ id, source: 'yue2', lang, expect, text, songId: yue2 });
  return [
    { ...y('yue2-cover-en', 'en', 'cover', 'Make a cover of this song: keep the melody, but new English words about leaving home.'), create: true },
    { id: 'ace1-cover-de', source: 'acestep', lang: 'de', expect: 'cover', songId: ace[0], create: true, text: 'Mach daraus eine Coverversion auf Deutsch: gleiche Melodie, neuer Text über den Herbst.' },
    { id: 'ace2-borrow-en', source: 'acestep', lang: 'en', expect: 'borrow', songId: ace[1], text: 'Write me a brand-new song with the vibe of this one, about city lights at night.' },
    { id: 'upload-borrow-es', source: 'upload', lang: 'es', expect: 'borrow', file: upload, name: path.basename(upload), text: 'Escríbeme una canción nueva con el estilo de esta, sobre el mar.' },
    { id: 'non-audio', source: 'non-audio', lang: 'en', expect: 'refuse', file: txt, name: 'notes.txt', text: '' },
    y('yue2-cover-es', 'es', 'cover', 'Quiero esta misma canción, con la misma melodía, pero cantada sobre mi perro.'),
    y('yue2-borrow-de', 'de', 'borrow', 'Ein ganz neuer Song im Stil von diesem, aber über Freundschaft.'),
    y('yue2-borrow-en', 'en', 'borrow', 'A new song like this one, same vibe, about summer road trips.'),
    { id: 'named-cover-en', source: 'named', lang: 'en', expect: 'cover', songId: yue2, text: '' }, // text set from the title
    y('yue2-borrow-es', 'es', 'borrow', 'Hazme una canción nueva con este ambiente, pero sobre la lluvia.'),
    y('yue2-cover-de', 'de', 'cover', 'Genau dieses Lied, aber auf Deutsch gesungen.'),
  ];
}

/** Waits until the card is idle (util under 15 % three samples running) and the owner's app runs no job. */
async function gpuIdle(owner: string, log: (m: string) => void) {
  for (let i = 0, calm = 0; i < 1200; i++) {
    const util = Number(execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']).toString().trim());
    const active = owner ? (await json('GET', `${owner}/api/generate/active`, undefined, 3000).catch(() => ({ body: null }))).body?.active ?? null : null;
    calm = util < 15 && !active ? calm + 1 : 0;
    if (calm >= 3) return;
    if (i % 30 === 0) log(`  waiting for the GPU: util ${util} %, owner job ${active ? JSON.stringify(active).slice(0, 80) : 'none'}`);
    await sleep(1000);
  }
  throw new Error('the GPU stayed busy for 20 min');
}

async function main() {
  const server = arg('server', 'http://127.0.0.1:3401').replace(/\/+$/, '');
  const out = arg('out');
  const ollama = arg('ollama', 'http://127.0.0.1:11434').replace(/\/+$/, '');
  if (!out) throw new Error('need --out <dir> (pipeline/cp-c3/<date>/)');
  fs.mkdirSync(out, { recursive: true });
  const txt = path.join(out, 'notes.txt');
  fs.writeFileSync(txt, 'not audio: CP-C3 non-audio check\n');
  const only = arg('only') ? arg('only').split(',') : null;
  const list = specs(arg('yue2'), arg('ace').split(','), arg('upload'), txt).filter((s) => !only || only.includes(s.id));
  const logFile = fs.createWriteStream(path.join(out, 'run.log'), { flags: 'a' });
  const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
  const events: ProxyEvent[] = []; const gpu: GpuSample[] = []; const ps: PsSample[] = [];
  const ctx: Cp3Ctx = { server, proxied: true, events, gpu, ps, log, turnTimeoutMs: 300_000, readTimeoutMs: 1_200_000, takeTimeoutMs: 2_700_000 };
  const proxy = await startOllamaProxy(Number(arg('proxy-port', '11436')), ollama, events);
  const sampler = startGpuSampler(path.join(out, 'nvidia-smi.csv'), gpu);
  const stopPs = startPsSampler(ollama, ps);
  const legs: Leg[] = [];
  const order = specs('', [], '', '').map((s) => s.id);
  const prior = process.argv.includes('--merge') && fs.existsSync(path.join(out, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')) : null;
  const all = () => [...(prior?.legs ?? []).filter((p: Leg) => !legs.some((l) => l.id === p.id)), ...legs].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const started = new Date().toISOString();
  const owner = arg('owner', 'http://127.0.0.1:3001');
  const save = () => {
    const s = summarize(all());
    const meta = { server, started, date: started.slice(0, 10), idleMiB: gpu[0]?.mib ?? null, note: arg('note') };
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ meta, priorMeta: prior?.meta ?? null, summary: s, stopLines: stopLines(s), legs: all(), proxyEvents: [...(prior?.proxyEvents ?? []), ...events], ollamaPs: [...(prior?.ollamaPs ?? []), ...ps] }, null, 1));
    fs.writeFileSync(path.join(out, 'summary.md'), summaryMarkdown(s, all(), { server, date: meta.date, note: `Planner via the proxy to ${ollama}. GPU at start ${meta.idleMiB ?? '-'} MiB. ${meta.note}` }));
    return s;
  };
  try {
    await sleep(1500);
    const status = await json('GET', `${server}/api/chat/status`);
    log(`CP-C3 start: ${server}, status ${JSON.stringify(status.body)}, ${list.length} legs, GPU ${gpuOnce()} MiB`);
    for (const s of list) {
      const threadId = await newChat(ctx);
      const named = s.source === 'named';
      const text = named ? `Do a cover of ${arg('named-title')} from my library in English, keep its melody.` : s.text;
      const at = named ? { status: 0, ms: 0, referenceId: null, reason: null, name: arg('named-title') } : await attach(ctx, threadId, s);
      const leg: Leg = { id: s.id, source: s.source, name: at.name ?? s.name ?? '', lang: s.lang, expect: s.expect, text, attach: { status: at.status, ms: at.ms, reason: at.reason }, ask: null, reading: null, followUp: null };
      legs.push(leg);
      log(`${s.id}: attach ${at.status}${at.reason ? ` (${at.reason})` : ''}`);
      if (s.source === 'non-audio' || (!named && !at.referenceId)) { save(); continue; }
      let a = await ask(ctx, threadId, text, at.referenceId);
      if (a.action !== 'analyze' && process.argv.includes('--retry')) { // the person asks again, naming the reading
        leg.firstAsk = { action: a.action, turnMs: a.turnMs, reasons: a.reasons };
        log(`  ask: ${a.action} (${a.reasons[0]?.slice(0, 100) ?? ''}); asking again, reading first`);
        a = await ask(ctx, threadId, `${named ? `Read ${arg('named-title')} from my library first.` : READ_FIRST} ${text}`, at.referenceId);
      }
      leg.ask = { action: a.action, turnMs: a.turnMs, reasons: a.reasons };
      log(`  ask: ${a.action} in ${((a.turnMs ?? 0) / 1000).toFixed(1)} s ${a.reasons[0]?.slice(0, 120) ?? ''}`);
      if (a.action !== 'analyze' || !a.proposalId) { save(); continue; }
      await gpuIdle(owner, log);
      const r = await readAndFollow(ctx, threadId, a.proposalId);
      leg.reading = r.reading; leg.followUp = r.followUp;
      const f = r.followUp;
      log(`  reading ${r.reading.status}: steps ${JSON.stringify(r.reading.steps)}; score ${r.reading.score}; coverable ${r.reading.coverable}`);
      log(`  follow-up: ${f?.action ?? '-'} in ${((f?.turnMs ?? 0) / 1000).toFixed(1)} s, use ${f?.referenceUse ?? '-'} -> ${f?.finalUse ?? '-'} (expect ${s.expect}), ${f?.plannerVram ?? 'planner not seen'}, VRAM before ${f?.vramBeforeMiB ?? '-'} MiB ${f?.note ?? f?.reasons[0] ?? ''}`);
      if (s.create && r.recipeId) {
        await gpuIdle(owner, log);
        leg.create = await runCreate(ctx, threadId, r.recipeId);
        log(`  CREATE ${f?.finalUse === 'cover' ? 'COVER' : 'SONG'}: ${leg.create.outcome} ${leg.create.reason ?? ''}, hand-off ${leg.create.handoffMs ?? '-'} ms, take ${((leg.create.takeMs ?? 0) / 1000).toFixed(0)} s, song ${leg.create.songId ?? '-'}`);
      }
      save();
    }
  } finally {
    const s = save();
    sampler.kill(); stopPs(); proxy.close(); logFile.end();
    for (const l of stopLines(s)) console.log(`${l.verdict.padEnd(7)} ${l.text}`);
    if (stopLines(s).some((l) => l.verdict === 'STOP')) process.exitCode = 1;
  }
}

main().catch((err) => { console.error(`CP-C3 error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
