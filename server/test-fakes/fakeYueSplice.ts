/**
 * fakeYue's `/v1/splices` (CB-1's contract, D-039): replays one of the fixtures yue-server's pytest recorded
 * (`yue-server/tests/data/contract/splice-*.json`: ok, rerender, failed, hold; C4's chain: splice-chain-ok, -rerender,
 * -hold, whose spec has `steps` instead of `op`, compared the same way). A submit whose spec differs
 * from the recording gets a 500 naming that, never an invented reply: `op` (or `steps`), `base_abc` and a recorded
 * `base_grid` must be equal; `render_job` is a placeholder in the recording (`job-0001`), so only its presence
 * is matched; the optional `edited_abc` / `base_grid` the recording lacks may ride along. A cancel makes the
 * record `cancelled`; `/audio` and `/grid/{which}` answer only for a succeeded splice.
 */
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

export type SpliceName = 'splice-ok' | 'splice-rerender' | 'splice-failed' | 'splice-hold'
  | 'splice-chain-ok' | 'splice-chain-rerender' | 'splice-chain-hold';
export interface SpliceFixture {
  name: string;
  request: { method: string; path: string; form: { spec: Record<string, unknown> }; file: string };
  response: { status: number; body: Record<string, unknown> };
  final: { status: number; body: Record<string, unknown> & { id: string; status: string } };
}

export const loadSplice = (dir: string, name: SpliceName) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')) as SpliceFixture;

export interface SpliceScript {
  fixture: SpliceFixture;
  /** A refused submit (e.g. 422 "REWRITE_LYRICS is not spliced") instead of a job. */
  submit?: { status: number; detail: string };
  audio?: Buffer;
  /** GET /grid/{which}; absent = 404. */
  grids?: Partial<Record<'base' | 'render' | 'out', unknown>>;
  /** Every spec submitted, parsed, in order. */
  specs: Array<Record<string, unknown>>;
  cancelled: Set<string>;
}

const OPTIONAL = ['edited_abc', 'base_grid'];

/** Why `sent` is not the recorded spec, or null. */
function specMismatch(recorded: Record<string, unknown>, sent: Record<string, unknown>, same: (a: unknown, b: unknown) => boolean): string | null {
  for (const key of Object.keys(recorded)) {
    if (key === 'render_job' ? typeof sent[key] !== 'string' : !same(recorded[key], sent[key])) return key;
  }
  return Object.keys(sent).find((k) => !(k in recorded) && !OPTIONAL.includes(k)) ?? null;
}

/** The text of a multipart form's `spec` field. */
const specField = (raw: string) => /name="spec"\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([^\r]*)\r\n/.exec(raw)?.[1] ?? null;

type Send = (res: http.ServerResponse, status: number, body: unknown, type?: string) => void;

/** True when it answered. */
export function spliceRoute(
  script: SpliceScript, req: http.IncomingMessage, res: http.ServerResponse, route: string, raw: string,
  send: Send, same: (a: unknown, b: unknown) => boolean,
): boolean {
  const m = /^\/v1\/splices(?:\/([^/]+)(?:\/(cancel|audio|grid)(?:\/([^/]+))?)?)?$/.exec(route);
  if (!m) return false;
  const [, id, sub, which] = m;
  const fx = script.fixture;
  if (!id && req.method === 'POST') {
    const text = specField(raw);
    let spec: Record<string, unknown> = {};
    try { spec = JSON.parse(text ?? '') as Record<string, unknown>; } catch { return (send(res, 422, { detail: 'spec is not JSON' }), true); }
    script.specs.push(spec);
    if (script.submit) return (send(res, script.submit.status, { detail: script.submit.detail }), true);
    const off = specMismatch(fx.request.form.spec, spec, same);
    if (off) return (send(res, 500, { detail: `fakeYue: no recorded splice for spec.${off} = ${JSON.stringify(spec[off])}` }), true);
    script.cancelled.delete(fx.final.body.id);
    return (send(res, fx.response.status, fx.response.body), true);
  }
  if (id !== fx.final.body.id) return (send(res, 404, { detail: 'Splice not found' }), true);
  const cancelled = script.cancelled.has(id);
  if (sub === 'cancel') {
    if (!['succeeded', 'failed'].includes(fx.final.body.status)) script.cancelled.add(id);
    return (send(res, 200, { ...fx.final.body, ...(script.cancelled.has(id) ? { status: 'cancelled', stage: 'cancelled' } : {}) }), true);
  }
  if (sub === 'audio' || sub === 'grid') {
    if (cancelled || fx.final.body.status !== 'succeeded') return (send(res, 409, { detail: 'Artifact is not available for this job state' }), true);
    if (sub === 'audio') return (send(res, 200, script.audio ?? Buffer.from('RIFF-spliced-float32'), 'audio/wav'), true);
    const grid = script.grids?.[which as 'base'];
    return (grid ? send(res, 200, grid) : send(res, 404, { detail: 'Artifact not found' }), true);
  }
  return (send(res, fx.final.status, cancelled ? { ...fx.final.body, status: 'cancelled', stage: 'cancelled' } : fx.final.body), true);
}
