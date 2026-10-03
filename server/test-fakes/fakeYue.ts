/**
 * A yue-server for tests (D-039): its score routes answer with the replies yue-server's own
 * pytest recorded (`yue-server/tests/data/contract/*.json`), matched on the exact request body,
 * so the fake cannot drift from the real route. A request no fixture recorded gets a 500 naming
 * that, never an invented reply. The render job API is added with the render work (W4).
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

export interface FakeYue {
  url: string;
  requests: Array<{ path: string; body: unknown }>;
  close: () => Promise<void>;
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
  const fake: FakeYue = {
    url: '', requests: [],
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) as unknown : null;
      const route = (req.url ?? '').split('?')[0];
      fake.requests.push({ path: route, body });
      const hit = fixtures.find((f) => f.request.path === route && f.request.method === req.method && same(f.request.body, body));
      const reply = hit?.response ?? { status: 500, body: { detail: `fakeYue: no recorded reply for ${req.method} ${route}` } };
      res.writeHead(reply.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  fake.url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  return fake;
}
