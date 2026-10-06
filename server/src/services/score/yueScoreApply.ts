/**
 * yue-server's `POST /v1/scores/apply` (F-017, D-019): applies a plan's ops to the stored score
 * and checks the result (one verdict per op, upstream compare). Answers 200 with `ok: false` for
 * a plan it rejects; a 422 means the base score itself is not valid. CPU only. The base version's
 * stored lyrics go along (null = none stored: the key is left out), so REPEAT / CUT carry their
 * blocks and REWRITE_LYRICS edits them; the reply's `lyrics` are the edited ones (F-030, F-031).
 */
import { failure, headers, request, type EngineTarget } from '../engineClient.js';
import { yue2Engine } from '../engines/yue2.js';
import type { ApplyResult, Op } from './planTypes.js';

const APPLY_TIMEOUT_MS = 30_000;

/** What a plan is applied to: the active base version's score, style and lyrics (scoreSource). */
export interface ApplyBase { abc: string; style: string; lyrics: string | null }

export async function applyOps({ abc, style, lyrics }: ApplyBase, ops: Op[], target: EngineTarget = yue2Engine): Promise<ApplyResult> {
  const res = await request(target, '/v1/scores/apply', {
    method: 'POST',
    headers: headers(target, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ abc, style, ...(lyrics === null ? {} : { lyrics }), ops }),
  }, 'apply score ops', APPLY_TIMEOUT_MS);
  if (!res.ok) throw await failure(target, 'apply score ops', res);
  const body = (await res.json()) as ApplyResult;
  if (!Array.isArray(body.verdicts) || typeof body.abc !== 'string') {
    throw new Error(`${target.label} apply score ops -> unexpected reply`);
  }
  return body;
}
