/** REVISE (F-033, D-068, D-073): the planner sees the pending plan (its numbered ops, verdicts and notes) and
 * returns only what changes, {drop, ops} (reviseReply.ts); code merges that into the pending plan and the merged
 * plan is applied to the base as read (numbers unchanged, D-066 b). Each merged op is marked SAME (kept, or
 * returned unchanged), CHANGED (replaces the pending op on its target) or NEW (added); the dropped and the
 * superseded pending ops are listed removed (M2-6). A REVISE needs the plan on screen to still be the song's
 * pending plan and to have been made on the score as it is. Pure. */
import type { Op, OpMark, Plan, Since } from './planTypes.js';

export const NO_PENDING = 'there is no plan to revise: PLAN first';
export const PLAN_REPLACED = 'that plan was replaced or has expired: revise the plan on screen, or PLAN again';
export const PLAN_STALE = 'the song changed since that plan was made: PLAN again';
/** An empty {drop: [], ops: []}: fed back to the planner like NO_CHANGE (scoreLimits). */
export const NOTHING_REVISED = 'the revision changed nothing: list a pending op in drop, or return an op that changes or adds one';

/** Why a REVISE of `planId` cannot run, or null. `fingerprint` is the song's now (scoreSource). */
export function reviseRefusal(pending: Plan | undefined, planId: string, fingerprint: string): string | null {
  if (!pending) return NO_PENDING;
  if (pending.id !== planId) return PLAN_REPLACED;
  if (pending.fingerprint !== fingerprint) return PLAN_STALE;
  return null;
}

/** Key order is not meaning: `{bpm, op}` and `{op, bpm}` are the same op. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

type Of<K extends Op['op']> = Extract<Op, { op: K }>;

/** D-070 d's target: whole-song ops by kind, REHARMONIZE by overlapping bars, WRITE_PHRASE by start bar,
 * REPEAT / CUT by section (a REPEAT is not a CUT), REWRITE_LYRICS by block. */
export function sameTarget(a: Op, b: Op): boolean {
  if (a.op !== b.op) return false;
  switch (a.op) {
    case 'REHARMONIZE': { const o = b as Of<'REHARMONIZE'>; return a.from_bar <= o.to_bar && o.from_bar <= a.to_bar; }
    case 'WRITE_PHRASE': return a.start_bar === (b as Of<'WRITE_PHRASE'>).start_bar;
    case 'REPEAT': case 'CUT': return a.section === (b as Of<'REPEAT' | 'CUT'>).section;
    case 'REWRITE_LYRICS': return a.block === (b as Of<'REWRITE_LYRICS'>).block;
    default: return true;
  }
}

/** Where a merged op came from: a pending op number, a reply op number, or both (a replacement). */
export interface Origin { pending?: number; reply?: number }
export interface Merged extends Omit<Since, 'planId'> { ops: Op[]; from: Origin[] }

interface Slot { op: Op; mark: OpMark; was: Op | null; from: Origin }

/** The pending plan's ops without the dropped ones (1-based numbers), each returned op in place of the first
 * kept pending op on its target (any further kept ones on it are removed), the rest of the returned ops after. */
export function mergeRevise(pending: Op[], drop: number[], reply: Op[]): Merged {
  const slots: Array<Slot | null> = pending.map((op, k) => (drop.includes(k + 1) ? null
    : { op, mark: 'SAME', was: op, from: { pending: k + 1 } }));
  const added: Slot[] = [];
  reply.forEach((op, i) => {
    const hits = slots.flatMap((s, k) => (s && s.from.reply === undefined && sameTarget(op, pending[k]) ? [k] : []));
    if (!hits.length) { added.push({ op, mark: 'NEW', was: null, from: { reply: i + 1 } }); return; }
    const [k, ...superseded] = hits;
    slots[k] = { op, mark: canonical(op) === canonical(pending[k]) ? 'SAME' : 'CHANGED', was: pending[k], from: { pending: k + 1, reply: i + 1 } };
    superseded.forEach((j) => { slots[j] = null; });
  });
  const all = [...slots.filter((s): s is Slot => s !== null), ...added];
  return {
    ops: all.map((s) => s.op), from: all.map((s) => s.from),
    marks: all.map(({ mark, was }) => ({ mark, was })),
    removed: pending.filter((_, k) => slots[k] === null),
  };
}

/** How the planner is asked to reply to a REVISE: only what changes (D-073), on the pending plan's numbers. */
export const REVISE_LINES = [
  'The REQUEST below changes this pending plan. Reply with {"drop":[...],"ops":[...]} and return only what changes: '
    + "list a pending op's number in drop to remove it; put each new op, and each pending op the request changes, in full in ops. "
    + 'An op in ops replaces the pending op on the same target (SET_TEMPO, EDIT_STYLE, TRANSPOSE: the same kind; REHARMONIZE: overlapping bars; '
    + 'WRITE_PHRASE: the same start_bar; REPEAT or CUT: the same section; REWRITE_LYRICS: the same block); any other op is added.',
  'Leave the other pending ops out of your reply: everything else stays as it is. '
    + 'All numbers still mean the song as read above, not as the pending plan would leave it.',
];

/** The PENDING PLAN block of a REVISE's user message, just before its REQUEST: ops numbered 1..P for `drop`. */
export function pendingLines(plan: Pick<Plan, 'request' | 'ops' | 'verdicts' | 'revision'>): string[] {
  const ops = plan.ops.map((op, i) => {
    const { op: name, ...fields } = op;
    const v = plan.verdicts[i];
    const verdict = !v || v.ok ? 'applied' : `refused (${v.reason ?? 'did not apply'})`;
    return `op ${i + 1} ${name} ${JSON.stringify(fields)}: ${verdict}${v?.note ? `; note: ${v.note}` : ''}`;
  });
  return [`PENDING PLAN (plan ${plan.revision ?? 1}, made for: ${JSON.stringify(plan.request)}):`, ...ops, ...REVISE_LINES];
}
