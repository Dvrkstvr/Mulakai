/**
 * A stand-in for yue-server, just wide enough for the SCORE spec (F-028). The score routes
 * (`/v1/scores/read`, `/v1/scores/apply`) replay yue-server's recorded contract replies, matched on
 * the exact request body; a body nothing recorded gets a 500 naming that, never an invented reply.
 * The job API (`/v1/jobs`, the YuE2 first take and the score render) is a short script shaped like
 * yue-server's job records: running for a moment, then succeeded, with a canned tone as audio and,
 * as its score, the one it was sent (a render) or the recorded song's (a first take).
 *
 * `/v1/transcriptions` (a chat analysis's chords run for the beat) replays the recorded chords run and the
 * contract song's grid (transcriptions.ts); `/v1/scores/bars` is a score route like the others.
 *
 * `/v1/splices` (the chat's APPLY of a spliced edit) replays the recorded `splice-*.json` the same way
 * (splices.ts): a spec nothing recorded gets a 500 naming the field.
 *
 * Ours, not yue-server's: GET /__fake/jobs, the bodies every submit carried, oldest first;
 * POST /__fake/splice {fixture}, which recorded outcome the next splice replays (ok, failed, hold, rerender).
 */
import http from 'node:http';
import { toneWav } from '../fake-acestep/wav.js';
import { allContracts, contract, recordedSong, same } from './contracts.js';
import { spliceRoute, spliceState } from './splices.js';
import { transcriptionRoute } from './transcriptions.js';

/** How long a job reports "running" before it succeeds, so the dock's render line is exercised. */
const PENDING_MS = Number(process.env.FAKE_YUE_PENDING_MS ?? 1500);
/** A take lasts as long as the recorded score says (179.3 s), so its analysis's bar times fit the audio (CL-8b);
 * mono 8 kHz keeps it under 3 MB. */
const DURATION_SEC = (contract('read-ok').response.body.facts as { header: { seconds: number } }).header.seconds;
const TAKE_FORMAT = { sampleRate: 8000, channels: 1 };

interface FakeJob { id: string; body: Record<string, unknown>; createdAt: number; cancelled: boolean }

type Send = (status: number, body: unknown, type?: string) => void;

export function startFakeYue(port: number): http.Server {
  const fixtures = allContracts();
  const jobs = new Map<string, FakeJob>();
  const splices = spliceState();

  function jobRecord(job: FakeJob) {
    if (job.cancelled) return { id: job.id, status: 'cancelled', stage: 'cancelled', progress: null, error: null };
    const elapsed = Date.now() - job.createdAt;
    if (elapsed < PENDING_MS) return { id: job.id, status: 'running', stage: 'synthesis', progress: elapsed / PENDING_MS, error: null };
    return { id: job.id, status: 'succeeded', stage: 'finished', progress: null, error: null };
  }

  function jobRoute(method: string, route: string, body: unknown, send: Send): boolean {
    const m = /^\/v1\/jobs(?:\/([^/]+)(?:\/(audio|score|cancel))?)?$/.exec(route);
    if (!m) return false;
    const [, id, sub] = m;
    if (!id && method === 'POST') {
      const job: FakeJob = { id: `yue-${jobs.size + 1}`, body: (body ?? {}) as Record<string, unknown>, createdAt: Date.now(), cancelled: false };
      jobs.set(job.id, job);
      send(202, { id: job.id, status: 'queued', stage: 'queued', progress: null, error: null });
      return true;
    }
    const job = id ? jobs.get(id) : undefined;
    if (!job) return (send(404, { detail: 'Job not found' }), true);
    if (sub === 'cancel') {
      job.cancelled = true;
      return (send(200, jobRecord(job)), true);
    }
    if (sub === 'audio') return (send(200, toneWav(DURATION_SEC, 330 + 55 * jobs.size, TAKE_FORMAT), 'audio/wav'), true);
    if (sub === 'score') {
      const sent = job.body.abc;
      return (send(200, typeof sent === 'string' ? sent : recordedSong().abc, 'text/plain; charset=utf-8'), true);
    }
    return (send(200, jobRecord(job)), true);
  }

  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { raw += c; });
    req.on('end', () => {
      const send: Send = (status, body, type = 'application/json') => {
        res.writeHead(status, { 'Content-Type': type });
        res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
      };
      const method = req.method ?? 'GET';
      const route = (req.url ?? '').split('?')[0];
      if (spliceRoute(splices, method, route, raw, send)) return; // multipart, before the JSON parse
      if (transcriptionRoute(method, route, raw, send)) return; // the analysis's chords run (multipart too)
      let body: unknown = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        return send(422, { detail: 'body is not JSON' });
      }
      if (method === 'GET' && (route === '/health' || route === '/health/ready')) return send(200, { status: 'ok' });
      if (method === 'GET' && route === '/__fake/jobs') return send(200, [...jobs.values()].map(({ id, body: b }) => ({ id, body: b })));
      if (jobRoute(method, route, body, send)) return;
      if (route.startsWith('/v1/scores/')) {
        const hit = fixtures.find((f) => f.request.path === route && f.request.method === method && same(f.request.body, body));
        if (hit) return send(hit.response.status, hit.response.body);
        return send(500, { detail: `fake yue-server: no recorded reply for ${method} ${route}` });
      }
      send(404, { detail: `fake yue-server has no route for ${method} ${route}` });
    });
  });
  server.listen(port, '127.0.0.1', () => console.log(`fake yue-server on http://127.0.0.1:${port}`));
  return server;
}
