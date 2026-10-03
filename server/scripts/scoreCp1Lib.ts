/**
 * CP1-ONLY helpers for scoreCp1.ts (pipeline checkpoint after W2; not app code, never imported by src/).
 * - a recording proxy in front of Ollama, so the server's own planner calls, unload ack and
 *   /api/ps polls are timed from outside without touching server code;
 * - an nvidia-smi sampler (-lms 250);
 * - the render step W4 (F-023) will own: yue-server job with cot full, then a new base version
 *   written straight into the THROWAWAY DATA_DIR (D-040). Shape follows architecture.md "Data".
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import Database from 'better-sqlite3';

export const now = () => Date.now();
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ProxyEvent { t0: number; t1: number; method: string; path: string; status: number; info: Record<string, unknown> }

/** Forwards everything to `target`; records timing and a body summary per call (no prompts kept). */
export function startOllamaProxy(port: number, target: string, events: ProxyEvent[]): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const t0 = now();
      const body = Buffer.concat(chunks);
      try {
        const up = await fetch(`${target}${req.url}`, {
          method: req.method, headers: { 'Content-Type': 'application/json' },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        });
        const out = Buffer.from(await up.arrayBuffer());
        const t1 = now();
        res.writeHead(up.status, { 'Content-Type': up.headers.get('content-type') ?? 'application/json' });
        res.end(out);
        events.push({ t0, t1, method: req.method ?? '?', path: req.url ?? '?', status: up.status, info: summarize(req.url ?? '', body, out) });
      } catch (err) {
        res.writeHead(502).end(String(err));
        events.push({ t0, t1: now(), method: req.method ?? '?', path: req.url ?? '?', status: 502, info: { error: String(err) } });
      }
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

function summarize(url: string, reqBody: Buffer, resBody: Buffer): Record<string, unknown> {
  const j = (b: Buffer) => { try { return JSON.parse(b.toString('utf8')); } catch { return null; } };
  if (url.startsWith('/v1/chat/completions')) {
    const q = j(reqBody); const r = j(resBody);
    return { messages: q?.messages?.length, promptChars: JSON.stringify(q?.messages ?? []).length, usage: r?.usage, content: r?.choices?.[0]?.message?.content };
  }
  if (url.startsWith('/api/ps')) {
    const r = j(resBody);
    return { models: (r?.models ?? []).map((m: { name: string; context_length?: number; size_vram?: number; size?: number }) => ({ name: m.name, ctx: m.context_length, size_vram: m.size_vram, size: m.size })) };
  }
  if (url.startsWith('/api/generate')) return { req: j(reqBody), res: j(resBody) };
  return {};
}

export interface GpuSample { t: number; mib: number; util: number }

/** nvidia-smi every 250 ms; raw CSV to `csvPath`, parsed samples kept in memory. */
export function startGpuSampler(csvPath: string, samples: GpuSample[]): ChildProcess {
  const out = fs.createWriteStream(csvPath);
  const p = spawn('nvidia-smi', ['--query-gpu=timestamp,memory.used,utilization.gpu', '--format=csv,noheader,nounits', '-lms', '250']);
  let buf = '';
  p.stdout.on('data', (d: Buffer) => {
    out.write(d);
    buf += d.toString();
    const lines = buf.split(/\r?\n/); buf = lines.pop() ?? '';
    for (const l of lines) {
      const [ts, mib, util] = l.split(',').map((s) => s.trim());
      const t = new Date(ts).getTime();
      if (Number.isFinite(t) && mib) samples.push({ t, mib: Number(mib), util: Number(util) });
    }
  });
  return p;
}

export const gpuAt = (s: GpuSample[], t: number) => [...s].reverse().find((x) => x.t <= t) ?? null;
export const gpuAfter = (s: GpuSample[], t: number) => s.find((x) => x.t >= t) ?? null;
export function gpuOnce(): number {
  return Number(execFileSync('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits']).toString().trim());
}

export async function json(method: string, url: string, body?: unknown, timeoutMs = 60_000): Promise<{ status: number; body: any; ms: number }> {
  const t0 = now();
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body: parsed, ms: now() - t0 };
}

export interface ProbeResult { route: string; status: number; ms: number; mibBefore: number; mibAfter: number; stage: string | null }

/** F-017 #5: the score routes while a YuE2 job runs: time each call and the card before/after. */
export async function probeScoreRoutes(yue: string, abc: string, style: string, lyrics: string, stage: string | null): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  const calls: Array<[string, unknown]> = [
    ['/v1/scores/read', { abc, lyrics }],
    ['/v1/scores/apply', { abc, style, ops: [{ op: 'SET_TEMPO', bpm: 100 }] }],
  ];
  for (const [route, body] of calls) {
    const mibBefore = gpuOnce();
    const r = await json('POST', `${yue}${route}`, body, 10_000);
    out.push({ route, status: r.status, ms: r.ms, mibBefore, mibAfter: gpuOnce(), stage });
  }
  return out;
}

export interface RenderOutcome {
  jobId: string; status: string; wallS: number; audioSeconds: number | null; truncated: unknown;
  tokens: unknown; timing: Record<string, number> | null; tokPerS: number | null; error: unknown;
  audio: Buffer | null; score: string | null; probes: ProbeResult[];
}

/** POST /v1/jobs {abc, cot: 'full', style, lyrics, seed} (D-010, D-023) and wait; probes once mid-semantic. */
export async function renderOnYue(yue: string, req: { abc: string; style: string; lyrics: string; seed: number }, log: (m: string) => void): Promise<RenderOutcome> {
  const t0 = now();
  const sub = await json('POST', `${yue}/v1/jobs`, { ...req, cot: 'full' });
  if (sub.status !== 202 && sub.status !== 200) throw new Error(`yue submit ${sub.status}: ${JSON.stringify(sub.body).slice(0, 300)}`);
  const jobId = sub.body.id as string;
  log(`render job ${jobId}`);
  let job: any; const probes: ProbeResult[] = []; let probed = 0;
  for (;;) {
    await sleep(1000);
    job = (await json('GET', `${yue}/v1/jobs/${jobId}`)).body;
    if (!['queued', 'running'].includes(job.status)) break;
    const semTok = job.tokens?.semantic ?? 0;
    if (job.stage === 'semantic' && ((probed === 0 && semTok > 300) || (probed === 1 && semTok > 2000))) {
      probes.push(...await probeScoreRoutes(yue, req.abc, req.style, req.lyrics, job.stage)); probed++;
    }
  }
  const res = job.result ?? {};
  const timing = res.timing ?? null;
  const sem = job.tokens?.semantic ?? null;
  const ok = job.status === 'succeeded' || job.status === 'truncated';
  const audio = ok ? Buffer.from(await (await fetch(`${yue}/v1/jobs/${jobId}/audio`)).arrayBuffer()) : null;
  const sc = ok ? await fetch(`${yue}/v1/jobs/${jobId}/score`) : null;
  return {
    jobId, status: job.status, wallS: (now() - t0) / 1000, audioSeconds: res.audio_seconds ?? null, truncated: res.truncated ?? null,
    tokens: job.tokens ?? null, timing, tokPerS: sem && timing?.semantic_seconds ? sem / timing.semantic_seconds : null,
    error: job.error ?? null, audio, score: sc && sc.ok ? await sc.text() : null, probes,
  };
}

/** CP1 stand-in for W4's scoreVersion: sidecar first (D-038), then an active base version + song meta. */
export function writeScoreVersion(dataDir: string, a: {
  songId: string; baseVersionId: string; audio: Buffer; abc: string; style: string; lyrics: string; seed: number;
  ops: unknown[]; request: string; label: string; meta: { bpm: number | null; keyScale: string; timeSignature: string };
}): string {
  const versionId = crypto.randomUUID();
  const audioDir = path.join(dataDir, 'audio');
  fs.writeFileSync(path.join(audioDir, `${versionId}.abc`), a.abc, 'utf8');
  fs.writeFileSync(path.join(audioDir, `${versionId}.flac`), a.audio);
  const db = new Database(path.join(dataDir, 'mulakai.db'));
  try {
    const layer = db.prepare(`SELECT id FROM layers WHERE song_id = ? AND kind = 'base'`).get(a.songId) as { id: string };
    const params = {
      score_v: 1, engine: 'yue2', task_type: 'score', cp1: true,
      request: { style: a.style, lyrics: a.lyrics, seed: a.seed, cot: 'full' },
      lyrics: a.lyrics, ops: a.ops, planRequest: a.request, meta: a.meta, basedOn: a.baseVersionId,
    };
    db.transaction(() => {
      db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layer.id);
      db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
        .run(versionId, layer.id, `${versionId}.flac`, a.label, JSON.stringify(params), String(a.seed));
      db.prepare(`UPDATE songs SET bpm = ?, key_scale = ?, time_signature = ? WHERE id = ?`)
        .run(a.meta.bpm, a.meta.keyScale, a.meta.timeSignature, a.songId);
    })();
  } finally {
    db.close();
  }
  return versionId;
}
