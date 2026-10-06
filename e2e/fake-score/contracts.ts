/**
 * yue-server's recorded score-route replies (D-039): `yue-server/tests/data/contract/*.json`, written
 * by its own pytest (`python -m pytest --record-contract`). The fake yue-server replays them and the
 * SCORE spec scripts the fake planner from them, so neither can drift from the real route. Mirrors
 * server/test-fakes/fakeYue.ts's loader and matching; e2e imports nothing from server/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../yue-server/tests/data/contract');

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

/** Key-order-free equality for JSON values. */
export function same(a: unknown, b: unknown): boolean {
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

/** The song every fixture was recorded against: its score, lyrics and stored style. */
export function recordedSong(): { abc: string; lyrics: string; style: string } {
  const read = contract('read-ok').request.body;
  const apply = contract('apply-set-tempo').request.body;
  return { abc: String(read.abc), lyrics: String(read.lyrics), style: String(apply.style) };
}

/** The planner reply that makes the server send exactly this fixture's ops to `/v1/scores/apply`. */
export function plannerReplyFor(name: string): string {
  return JSON.stringify({ ops: contract(name).request.body.ops });
}
