/** A REVISE's reply contract (D-073, Q-050): the planner returns only what changes, `{drop, ops}` (`drop`:
 * pending op numbers 1..P to remove; `ops`: new ops and changed versions of pending ones), as a strict schema
 * for `response_format` and the same bounds checked on the reply; code merges it into the pending plan
 * (planRevise.mergeRevise) and planAttempts applies the merged plan. A retry is told how its reply was merged,
 * since yue-server's reasons number the merged ops. Pure. */
import { DEFAULT_PHRASE_BARS } from './phraseRequest.js';
import { checkOps, int, MAX_OPS, opsArraySchema } from './opSchema.js';
import type { Reading } from './planAttempts.js';
import { mergeRevise, NOTHING_REVISED, type Merged } from './planRevise.js';
import type { Op, Plan, ScoreFacts, Since } from './planTypes.js';

export const REVISE_REPLY = 'Reply with the JSON {"drop":[...],"ops":[...]} only.';
export const REVISE_RETRY = 'Return a corrected {"drop":[...],"ops":[...]} as JSON only, on the PENDING PLAN\'s op numbers: only what changes.';
const SHAPE = 'the reply is not a JSON object {"drop":[...],"ops":[...]}';

export function buildReviseSchema(facts: ScoreFacts, pendingCount: number, phraseBars = DEFAULT_PHRASE_BARS): Record<string, unknown> {
  return {
    type: 'object', additionalProperties: false, required: ['drop', 'ops'],
    properties: {
      drop: { type: 'array', items: int(1, pendingCount), uniqueItems: true, maxItems: pendingCount },
      ops: opsArraySchema(facts, phraseBars, 0),
    },
  };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (label: string, ns: number[]) => (ns.length ? `; ${label}: ${ns.map((n) => `pending op ${n}`).join(', ')}` : '');

/** "op 1 = pending op 1, op 2 = your op 1 (replaces pending op 3), op 3 = your op 2 (new); dropped: pending op 2." */
export function mergeLegend(m: Merged, drop: number[], pendingCount: number): string {
  const ops = m.from.map((f, i) => `op ${i + 1} = ${f.reply === undefined ? `pending op ${f.pending}`
    : `your op ${f.reply} (${f.pending === undefined ? 'new' : `replaces pending op ${f.pending}`})`}`);
  const kept = new Set(m.from.flatMap((f) => f.pending ?? []));
  const covered = Array.from({ length: pendingCount }, (_, k) => k + 1).filter((n) => !kept.has(n) && !drop.includes(n));
  return `Your reply made this plan: ${ops.join(', ')}${list('dropped', [...drop].sort((a, b) => a - b))}${list('replaced by an op on its target', covered)}.`;
}

export type RevisedReading = (Reading & { ok: false }) | { ok: true; ops: Op[]; legend: string; merged: Merged };

/** Checks a parsed REVISE reply against the pending plan and the song, and merges it. */
export function readRevise(reply: unknown, pending: Op[], facts: ScoreFacts, phraseBars = DEFAULT_PHRASE_BARS): RevisedReading {
  if (!obj(reply) || !Array.isArray(reply.drop) || !Array.isArray(reply.ops)) return { ok: false, reasons: [SHAPE] };
  const p = pending.length;
  const drop = reply.drop as unknown[];
  const reasons = drop.flatMap((n, i) => (!isInt(n) || n < 1 || n > p ? [`drop ${String(n)} is not a pending op number (1-${p})`]
    : drop.indexOf(n) < i ? [`drop lists pending op ${n} twice`] : []));
  const shape = checkOps({ ops: reply.ops }, facts, phraseBars, 0);
  if (!shape.ok) reasons.push(...shape.reasons);
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };
  const dropped = drop as number[];
  if (!dropped.length && !reply.ops.length) return { ok: false, reasons: [NOTHING_REVISED] };
  const merged = mergeRevise(pending, dropped, shape.ok ? shape.ops : []);
  if (!merged.ops.length) return { ok: false, reasons: ['the revision drops every op: keep a pending op or return one'] };
  if (merged.ops.length > MAX_OPS) {
    return { ok: false, reasons: [`the revised plan has ${merged.ops.length} ops; at most ${MAX_OPS}: drop pending ops or return fewer`] };
  }
  return { ok: true, ops: merged.ops, legend: mergeLegend(merged, dropped, p), merged };
}

/** What planJob needs for a REVISE press: the schema, the reply and retry lines, a reader for planAttempts,
 * and the marks of the reply it last accepted (the one applied, once planAttempts succeeds). */
export function reviseContract(pending: Pick<Plan, 'id' | 'ops'>, facts: ScoreFacts, phraseBars = DEFAULT_PHRASE_BARS) {
  let last: Merged | null = null;
  return {
    schema: buildReviseSchema(facts, pending.ops.length, phraseBars),
    replyLine: REVISE_REPLY,
    retry: REVISE_RETRY,
    read: (json: unknown): Reading => {
      const r = readRevise(json, pending.ops, facts, phraseBars);
      last = r.ok ? r.merged : null;
      return r;
    },
    since: (): Since | null => (last ? { planId: pending.id, marks: last.marks, removed: last.removed } : null),
  };
}
