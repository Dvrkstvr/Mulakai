/**
 * The fake yue-server's `/v1/splices` (F-051, D-178): replays one of the splice fixtures yue-server's pytest
 * recorded (`yue-server/tests/data/contract/splice-*.json`), mirroring server/test-fakes/fakeYueSplice.ts (e2e
 * imports nothing from server/). A submit whose spec differs from the recording gets a 500 naming the field,
 * never an invented reply: every recorded key must be equal, except `render_job`, a placeholder in the
 * recording, whose presence is enough; the optional `edited_abc` / `base_grid` may ride along. A cancel makes
 * the record `cancelled`; `/audio` answers only for a succeeded splice, and no grid was recorded (404).
 */
import { toneWav } from '../fake-acestep/wav.js';
import { contract, same } from './contracts.js';

export type SpliceName = 'splice-ok' | 'splice-rerender' | 'splice-failed' | 'splice-hold';

interface SpliceFixture {
  request: { form: { spec: Record<string, unknown> } };
  response: { status: number; body: Record<string, unknown> };
  final: { status: number; body: Record<string, unknown> & { id: string; status: string } };
}

export interface SpliceState { name: SpliceName; specs: Array<Record<string, unknown>>; cancelled: Set<string> }

export const spliceState = (): SpliceState => ({ name: 'splice-ok', specs: [], cancelled: new Set() });

const OPTIONAL = ['edited_abc', 'base_grid'];

function mismatch(recorded: Record<string, unknown>, sent: Record<string, unknown>): string | null {
  for (const key of Object.keys(recorded)) {
    if (key === 'render_job' ? typeof sent[key] !== 'string' : !same(recorded[key], sent[key])) return key;
  }
  return Object.keys(sent).find((k) => !(k in recorded) && !OPTIONAL.includes(k)) ?? null;
}

/** The text of a multipart form's `spec` field. */
const specField = (raw: string) => /name="spec"\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([^\r]*)\r\n/.exec(raw)?.[1] ?? null;

type Send = (status: number, body: unknown, type?: string) => void;

/** True when it answered: `/v1/splices…`, and our `POST /__fake/splice {fixture}`. */
export function spliceRoute(state: SpliceState, method: string, route: string, raw: string, send: Send): boolean {
  if (route === '/__fake/splice') {
    const picked = (raw ? JSON.parse(raw) : {}) as { fixture?: SpliceName };
    if (picked.fixture) state.name = picked.fixture;
    return (send(200, { fixture: state.name, specs: state.specs }), true);
  }
  const m = /^\/v1\/splices(?:\/([^/]+)(?:\/(cancel|audio|grid)(?:\/[^/]+)?)?)?$/.exec(route);
  if (!m) return false;
  const [, id, sub] = m;
  const fx = contract(state.name) as unknown as SpliceFixture;
  if (!id && method === 'POST') {
    let spec: Record<string, unknown>;
    try { spec = JSON.parse(specField(raw) ?? '') as Record<string, unknown>; } catch { return (send(422, { detail: 'spec is not JSON' }), true); }
    state.specs.push(spec);
    const off = mismatch(fx.request.form.spec, spec);
    if (off) return (send(500, { detail: `fake yue-server: no recorded splice for spec.${off}` }), true);
    state.cancelled.delete(fx.final.body.id);
    return (send(fx.response.status, fx.response.body), true);
  }
  if (id !== fx.final.body.id) return (send(404, { detail: 'Splice not found' }), true);
  const cancelled = state.cancelled.has(id);
  const record = cancelled ? { ...fx.final.body, status: 'cancelled', stage: 'cancelled' } : fx.final.body;
  if (sub === 'cancel') {
    if (!['succeeded', 'failed'].includes(fx.final.body.status)) state.cancelled.add(id);
    return (send(200, state.cancelled.has(id) ? { ...fx.final.body, status: 'cancelled', stage: 'cancelled' } : fx.final.body), true);
  }
  if (sub === 'audio' || sub === 'grid') {
    if (cancelled || fx.final.body.status !== 'succeeded') return (send(409, { detail: 'Artifact is not available for this job state' }), true);
    return (sub === 'audio' ? send(200, toneWav(12, 392), 'audio/wav') : send(404, { detail: 'Artifact not found' }), true);
  }
  return (send(fx.final.status, record), true);
}
