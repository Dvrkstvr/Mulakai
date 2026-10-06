/**
 * CP1 (pipeline checkpoint after W2; scope.md M0): request -> plan -> apply -> render -> new version on the real
 * machine. Drives the REAL server over HTTP for the plan (POST/GET /api/songs/:id/score/plan). W4's render route does
 * not exist yet, so the render is CP1-only code (scoreCp1Lib.ts): the plan's ops re-applied by yue-server's
 * /v1/scores/apply (deterministic, the same call planJob made), a cot-full yue-server job, a version row written into
 * the THROWAWAY DATA_DIR (D-040). Run the server with LLM_API_URL pointed at this script's proxy (--proxy-port).
 *
 *   npx tsx scripts/scoreCp1.ts --server http://127.0.0.1:3201 --data <copy> --yue http://127.0.0.1:8004 \
 *     --ollama http://127.0.0.1:11435 --proxy-port 11436 --out <dir> --songs id1,id2,id3 [--render tempo,jazz]
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  gpuAfter, gpuAt, json, now, renderOnYue, sleep, startGpuSampler, startOllamaProxy, writeScoreVersion,
  type GpuSample, type ProxyEvent,
} from './scoreCp1Lib.js';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SERVER = arg('server', 'http://127.0.0.1:3201');
const DATA = arg('data');
const YUE = arg('yue', 'http://127.0.0.1:8004');
const OLLAMA = arg('ollama', 'http://127.0.0.1:11435');
const OUT = arg('out');
const SONGS = arg('songs').split(',').filter(Boolean);
const RENDER = new Set(arg('render', 'tempo,jazz').split(',').filter(Boolean));
const USER_APP = arg('user-app', 'http://127.0.0.1:3001');
const REQUESTS: Array<[string, string]> = [['tempo', 'set it to 88 BPM'], ['jazz', 'jazz chords in the chorus']];
if (!DATA || !OUT || SONGS.length === 0) throw new Error('need --data, --out, --songs');
if (path.resolve(DATA) === path.resolve('data')) throw new Error('refusing the live DATA_DIR (D-040)');

fs.mkdirSync(OUT, { recursive: true });
const logFile = fs.createWriteStream(path.join(OUT, 'run.log'), { flags: 'a' });
const log = (m: string) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); logFile.write(l + '\n'); };
const events: ProxyEvent[] = [];
const gpu: GpuSample[] = [];
const psDirect: Array<{ t: number; models: string[] }> = [];
const record: Record<string, unknown> = { started: new Date().toISOString(), songs: SONGS, plans: [] as unknown[], renders: [] as unknown[] };
const plans = record.plans as Record<string, unknown>[];
const renders = record.renders as Record<string, unknown>[];
const save = () => fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify({ ...record, proxyEvents: events, psDirect }, null, 1));

/** The user's own app may start a GPU job at any moment: wait while it reports one. */
async function waitUserIdle(): Promise<unknown> {
  for (let i = 0; ; i++) {
    const r = await json('GET', `${USER_APP}/api/generate/active`).catch(() => null);
    const busy = r && r.status === 200 && r.body?.active;
    if (!busy) return r?.body ?? 'user app unreachable';
    if (i % 10 === 0) log(`user app busy: ${JSON.stringify(r.body).slice(0, 200)}; waiting`);
    await sleep(3000);
  }
}

function songRow(songId: string) {
  const db = new Database(path.join(DATA, 'mulakai.db'), { readonly: true });
  try {
    const s = db.prepare(`SELECT id, bpm, key_scale, time_signature FROM songs WHERE id = ?`).get(songId) as { bpm: number; key_scale: string; time_signature: string };
    const v = db.prepare(`SELECT v.id, v.params_json FROM versions v JOIN layers l ON l.id = v.layer_id WHERE l.song_id = ? AND l.kind = 'base' AND v.active = 1`).get(songId) as { id: string; params_json: string };
    const req = JSON.parse(v.params_json).request as { style: string; lyrics: string; seed: number };
    return { song: s, versionId: v.id, req, abc: fs.readFileSync(path.join(DATA, 'audio', `${v.id}.abc`), 'utf8') };
  } finally { db.close(); }
}

async function runPlan(songId: string, key: string, request: string, index: number) {
  const user = await waitUserIdle();
  const base = songRow(songId);
  const t0 = now();
  const vramBefore = gpuAt(gpu, t0);
  const post = await json('POST', `${SERVER}/api/songs/${songId}/score/plan`, { request });
  log(`plan ${songId.slice(0, 8)} ${key}: POST ${post.status} ${JSON.stringify(post.body).slice(0, 200)}`);
  let got: any = null;
  while (post.status === 202) {
    await sleep(250);
    got = (await json('GET', `${SERVER}/api/songs/${songId}/score/plan`)).body;
    if (got?.run && !['queued', 'loading', 'running'].includes(got.run.status)) break;
  }
  const t1 = now();
  const ev = events.filter((e) => e.t0 >= t0 - 50 && e.t1 <= t1 + 50);
  const chats = ev.filter((e) => e.path.startsWith('/v1/chat'));
  const ack = ev.find((e) => e.path.startsWith('/api/generate'));
  const emptyAfterAck = ack ? ev.find((e) => e.path.startsWith('/api/ps') && e.t0 >= ack.t1 && (e.info.models as unknown[]).length === 0) : undefined;
  const directEmpty = ack ? psDirect.find((p) => p.t >= ack.t1 && p.models.length === 0) : undefined;
  const loadedPs = ev.filter((e) => e.path.startsWith('/api/ps') && (e.info.models as unknown[]).length > 0).map((e) => e.info.models);
  await sleep(1500);
  const empty = emptyAfterAck?.t1 ?? t1;
  const entry = {
    index, songId, key, request, baseVersionId: base.versionId, userApp: user, post: { status: post.status, body: post.body },
    latencyS: (t1 - t0) / 1000, run: got?.run ?? null, plan: got?.plan ?? null,
    chatCalls: chats.map((c) => ({ ms: c.t1 - c.t0, status: c.status, usage: c.info.usage, promptChars: c.info.promptChars, content: c.info.content })),
    unload: ack ? { ackAt: ack.t1, ackMs: ack.t1 - ack.t0, serverPsEmptyAfterAckMs: emptyAfterAck ? emptyAfterAck.t1 - ack.t1 : null, directPsEmptyAfterAckMs: directEmpty ? directEmpty.t - ack.t1 : null } : null,
    psWhileLoaded: loadedPs.slice(0, 2),
    vram: { beforeMiB: vramBefore?.mib ?? null, peakMiB: Math.max(...gpu.filter((g) => g.t >= t0 && g.t <= t1).map((g) => g.mib)), atEmptyMiB: gpuAfter(gpu, empty)?.mib ?? null, plus1sMiB: gpuAfter(gpu, empty + 1000)?.mib ?? null },
  };
  plans.push(entry); save();
  log(`plan ${songId.slice(0, 8)} ${key}: ${got?.run?.status} in ${entry.latencyS.toFixed(1)} s, attempts ${got?.plan?.attempts ?? '-'}, ops ${JSON.stringify(got?.plan?.ops ?? got?.run?.reasons).slice(0, 300)}; unload ${JSON.stringify(entry.unload)}; vram ${JSON.stringify(entry.vram)}`);
  return { entry, base };
}

async function runRender(p: Awaited<ReturnType<typeof runPlan>>) {
  const { entry, base } = p;
  const plan = entry.plan as { ops: unknown[]; style: string; checks: { seconds: number; tokens: number } } | null;
  if (!plan) { log('no plan, no render'); return; }
  const user = await waitUserIdle();
  const applied = await json('POST', `${YUE}/v1/scores/apply`, { abc: base.abc, style: base.req.style, ops: plan.ops });
  const a = applied.body as { ok: boolean; abc: string; style: string; seconds: number; tokens: number; bpm: number };
  const same = { style: a.style === plan.style, seconds: a.seconds === plan.checks.seconds, tokens: a.tokens === plan.checks.tokens };
  const mibBefore = gpuAt(gpu, now())?.mib ?? null;
  log(`render ${entry.songId.slice(0, 8)} ${entry.key}: re-apply ${applied.status} ok=${a.ok} matches plan ${JSON.stringify(same)}; est ${a.seconds} s, ${a.tokens} tokens`);
  const r = await renderOnYue(YUE, { abc: a.abc, style: a.style, lyrics: base.req.lyrics, seed: base.req.seed }, log);
  const out: Record<string, unknown> = {
    songId: entry.songId, key: entry.key, planIndex: entry.index, userApp: user, reapplyMatchesPlan: same, estSeconds: a.seconds, tokens: a.tokens,
    newQ: a.bpm, jobId: r.jobId, status: r.status, wallS: r.wallS, audioSeconds: r.audioSeconds, truncated: r.truncated, tokPerS: r.tokPerS,
    yueTokens: r.tokens, timing: r.timing, error: r.error, probes: r.probes, scoreReturnedEqualsSent: r.score === null ? null : r.score === a.abc,
    vramBeforeMiB: mibBefore, peakMiB: Math.max(...gpu.filter((g) => g.t >= now() - r.wallS * 1000).map((g) => g.mib)),
  };
  if (r.audio) {
    const label = `score edit · ${entry.key === 'tempo' ? `SET TEMPO ${a.bpm}` : 'REHARMONIZE'} (CP1)${r.status === 'truncated' ? ' (truncated)' : ''}`;
    out.versionId = writeScoreVersion(DATA, {
      songId: entry.songId, baseVersionId: entry.baseVersionId, audio: r.audio, abc: r.score ?? a.abc, style: a.style,
      lyrics: base.req.lyrics, seed: base.req.seed, ops: plan.ops, request: entry.request, label,
      meta: { bpm: a.bpm, keyScale: base.song.key_scale, timeSignature: base.song.time_signature },
    });
    out.audioFile = path.join(DATA, 'audio', `${out.versionId}.flac`);
    out.baseAbcFile = path.join(DATA, 'audio', `${entry.baseVersionId}.abc`);
  }
  renders.push(out); save();
  log(`render ${entry.songId.slice(0, 8)} ${entry.key}: ${r.status} ${r.wallS.toFixed(0)} s wall, ${r.tokPerS?.toFixed(1)} tok/s, audio ${r.audioSeconds} s vs est ${a.seconds} s, truncated ${JSON.stringify(r.truncated)}, version ${out.versionId}`);
}

async function main() {
  const proxyPort = Number(arg('proxy-port', '11436'));
  const proxy = await startOllamaProxy(proxyPort, OLLAMA, events);
  const sampler = startGpuSampler(path.join(OUT, 'nvidia-smi.csv'), gpu);
  let polling = true;
  void (async () => { while (polling) { const r = await json('GET', `${OLLAMA}/api/ps`).catch(() => null); psDirect.push({ t: now(), models: (r?.body?.models ?? []).map((m: { name: string }) => m.name) }); await sleep(100); } })();
  await sleep(1500);
  log(`CP1 start: songs ${SONGS.join(', ')}; render ${[...RENDER].join(',')}; gpu ${gpu.at(-1)?.mib} MiB`);
  let i = 0;
  try {
    for (const songId of SONGS) {
      for (const [key, request] of REQUESTS) {
        const p = await runPlan(songId, key, request, i++);
        if (RENDER.has(key) && p.entry.plan) await runRender(p);
      }
    }
  } finally {
    polling = false; record.finished = new Date().toISOString(); save();
    sampler.kill(); proxy.close(); logFile.end();
  }
}

main().catch((err) => { log(`CP1 error: ${err instanceof Error ? err.stack : String(err)}`); process.exitCode = 1; });
