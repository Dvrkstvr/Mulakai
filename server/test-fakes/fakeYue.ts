/**
 * A yue-server for tests (D-039): its score routes answer with the replies yue-server's own
 * pytest recorded (`yue-server/tests/data/contract/*.json`), matched on the exact request body,
 * so the fake cannot drift from the real route. A request no fixture recorded gets a 500 naming
 * that, never an invented reply. The render job API (`/v1/jobs`, W4) is a minimal script instead,
 * shaped like yue-server's main.py / jobs.py records: `job` says how the next submit plays out.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../yue-server/tests/data/contract');

export interface ContractFixture {
  name: string;
  request: { method: string; path: string; body: Record<string, unknown> };
  response: { status: number; body: Record<string, unknown> };
}

export function contract(name: string): ContractFixture {
  return JSON.parse(fs.readFileSync(path.join(CONTRACT_DIR, `${name}.json`), 'utf8')) as ContractFixture;
}

export function allContracts(): ContractFixture[] {
  return fs.readdirSync(CONTRACT_DIR).filter((f) => f.endsWith('.json')).map((f) => contract(f.slice(0, -5)));
}

/** One state a polled job reports (yue-server's `status`, `stage`, `progress`, `error`). */
export interface JobState { status: 'queued' | 'running' | 'succeeded' | 'truncated' | 'failed'; stage?: string; progress?: number; error?: { code: string; message: string } }

export interface JobScript {
  /** Successive GET /v1/jobs/:id answers; the last one repeats until a cancel. */
  states: JobState[];
  /** A refused submit (e.g. 422 with `detail`) instead of a job. */
  submit?: { status: number; detail: string };
  audio?: Buffer;
  /** null = 404, as for a job with no score. */
  score?: string | null;
}

export interface FakeYue {
  url: string;
  requests: Array<{ method?: string; path: string; body: unknown }>;
  /** How the next render job plays out. */
  job: JobScript;
  /** Bodies of every POST /v1/jobs, in order. */
  submits: () => unknown[];
  close: () => Promise<void>;
}

const send = (res: http.ServerResponse, status: number, body: unknown, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
};

/** The job API: true when it answered. A job advances one state per poll; a cancel ends it. */
function jobRoute(fake: FakeYue, polls: Map<string, number>, req: http.IncomingMessage, res: http.ServerResponse, route: string): boolean {
  const m = /^\/v1\/jobs(?:\/([^/]+)(?:\/(audio|score|cancel))?)?$/.exec(route);
  if (!m) return false;
  const [, id, sub] = m;
  const script = fake.job;
  if (!id && req.method === 'POST') {
    if (script.submit) return (send(res, script.submit.status, { detail: script.submit.detail }), true);
    const jobId = `yue-${polls.size + 1}`;
    polls.set(jobId, 0);
    return (send(res, 202, { id: jobId, status: 'queued', stage: 'queued' }), true);
  }
  if (!id || !polls.has(id)) return (send(res, 404, { detail: 'Job not found' }), true);
  const n = polls.get(id)!;
  if (sub === 'cancel') return (polls.set(id, -1), send(res, 200, { id, status: 'cancelled' }), true);
  if (sub === 'audio') return (send(res, 200, script.audio ?? Buffer.from('fLaC-fake'), 'audio/flac'), true);
  if (sub === 'score') {
    return (script.score === null ? send(res, 404, { detail: 'Artifact not found' }) : send(res, 200, script.score ?? 'X:1\nK:C\n', 'text/plain'), true);
  }
  if (n < 0) return (send(res, 200, { id, status: 'cancelled', stage: 'cancelled' }), true);
  polls.set(id, n + 1);
  return (send(res, 200, { id, ...script.states[Math.min(n, script.states.length - 1)] }), true);
}

/** Key-order-free equality for JSON values. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    return ka.length === Object.keys(b as object).length
      && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

export async function startFakeYue(fixtures: ContractFixture[] = allContracts()): Promise<FakeYue> {
  const polls = new Map<string, number>();
  const fake: FakeYue = {
    url: '', requests: [], job: { states: [{ status: 'succeeded', stage: 'done' }] },
    submits: () => fake.requests.filter((r) => r.method === 'POST' && r.path === '/v1/jobs').map((r) => r.body),
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) as unknown : null;
      const route = (req.url ?? '').split('?')[0];
      fake.requests.push({ method: req.method, path: route, body });
      if (jobRoute(fake, polls, req, res, route)) return;
      const hit = fixtures.find((f) => f.request.path === route && f.request.method === req.method && same(f.request.body, body));
      const reply = hit?.response ?? { status: 500, body: { detail: `fakeYue: no recorded reply for ${req.method} ${route}` } };
      send(res, reply.status, reply.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  fake.url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  return fake;
}
