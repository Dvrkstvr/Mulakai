/** REVISE (F-033, D-068): the planner sees the pending plan (its ops, verdicts and notes) and returns a
 * complete replacement, applied to the base as read (numbers unchanged, D-066 b); the new plan's ops are
 * marked NEW / CHANGED / SAME against the replaced plan's, with the ops it dropped listed (M2-6). A REVISE
 * needs the plan on screen to still be the song's pending plan and to have been made on the score as it is.
 * Pure. */
import type { Op, OpMark, Plan, Since } from './planTypes.js';

export const NO_PENDING = 'there is no plan to revise: PLAN first';
export const PLAN_REPLACED = 'that plan was replaced or has expired: revise the plan on screen, or PLAN again';
export const PLAN_STALE = 'the song changed since that plan was made: PLAN again';

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

/** What an op works on: two ops with one target are one op, the same or changed. */
function target(o: Op): string {
  switch (o.op) {
    case 'REHARMONIZE': return `${o.op} ${o.from_bar}-${o.to_bar}`;
    case 'WRITE_PHRASE': return `${o.op} ${o.start_bar}`;
    case 'REPEAT': case 'CUT': return `${o.op} S${o.section}`;
    case 'REWRITE_LYRICS': return `${o.op} ${o.block}`;
    default: return o.op;
  }
}

const span = (o: Op): [number, number] | null => (o.op === 'REHARMONIZE' ? [o.from_bar, o.to_bar]
  : o.op === 'WRITE_PHRASE' ? [o.start_bar, o.start_bar + o.bars.length - 1] : null);
function overlaps(a: Op, b: Op): boolean {
  const [x, y] = [span(a), span(b)];
  return a.op === b.op && !!x && !!y && x[0] <= y[1] && y[0] <= x[1];
}

/** Matches each new op to an unclaimed old one: an equal op (SAME), then the same target (CHANGED), then the
 * same kind over overlapping bars (CHANGED); the rest are NEW, and the old ops left unclaimed are removed. */
export function markOps(prev: Pick<Plan, 'id' | 'ops'>, next: Op[]): Since {
  const claimed = new Set<number>();
  const marks: Array<{ mark: OpMark; was: Op | null } | null> = next.map(() => null);
  const pass = (fits: (a: Op, b: Op) => boolean, mark: OpMark) => next.forEach((op, i) => {
    if (marks[i]) return;
    const j = prev.ops.findIndex((old, k) => !claimed.has(k) && fits(op, old));
    if (j < 0) return;
    claimed.add(j);
    marks[i] = { mark, was: prev.ops[j] };
  });
  pass((a, b) => canonical(a) === canonical(b), 'SAME');
  pass((a, b) => target(a) === target(b), 'CHANGED');
  pass(overlaps, 'CHANGED');
  return {
    planId: prev.id,
    marks: marks.map((m) => m ?? { mark: 'NEW', was: null }),
    removed: prev.ops.filter((_, k) => !claimed.has(k)),
  };
}

/** The PENDING PLAN block of a REVISE's user message, just before its REQUEST. */
export function pendingLines(plan: Pick<Plan, 'request' | 'ops' | 'verdicts' | 'revision'>): string[] {
  const ops = plan.ops.map((op, i) => {
    const { op: name, ...fields } = op;
    const v = plan.verdicts[i];
    const verdict = !v || v.ok ? 'applied' : `refused (${v.reason ?? 'did not apply'})`;
    return `op ${i + 1} ${name} ${JSON.stringify(fields)}: ${verdict}${v?.note ? `; note: ${v.note}` : ''}`;
  });
  return [
    `PENDING PLAN (plan ${plan.revision ?? 1}, made for: ${JSON.stringify(plan.request)}):`,
    ...ops,
    'The REQUEST below changes this pending plan. Reply with the COMPLETE new op list that replaces it: copy every pending op '
      + 'the request does not change exactly as it is, change or drop the ones it is about, add any new ones. All numbers still mean the song '
      + 'as read above, not as the pending plan would leave it.',
  ];
}
