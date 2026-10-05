/** SCORE's REVISE copy (F-033; pipeline/design/score-m2.html frames 6-9, M2-5..M2-7): the plan header with its
 * revision and FOR, the "since plan 1" marks and removed ops, REVISING's lines, and the two failures (a failed
 * REVISE keeps the plan, D-063; a failed fresh PLAN dropped it, D-028). Pure. Part of the SCORE copy (dock rule),
 * re-exported by scoreCopy.ts. */
import type { ScoreOpMark, ScorePlan } from './api';
import { forClause } from './scoreReferentCopy';

const revisionOf = (plan: Pick<ScorePlan, 'revision'>) => plan.revision ?? 1;

/** `PLAN · 3 CHANGES · AGAINST BASE v2`, `PLAN 2 · REVISED FROM PLAN 1 · 2 CHANGES · AGAINST BASE v2 · FOR CHORUS 2 (BARS 29–36)`. */
export function planTitle(plan: ScorePlan, baseVersion: number | null | undefined): string {
  const rev = revisionOf(plan);
  const head = rev > 1 ? `PLAN ${rev} · REVISED FROM PLAN ${rev - 1}` : 'PLAN';
  const changes = `${plan.ops.length} CHANGE${plan.ops.length === 1 ? '' : 'S'}`;
  return `${head} · ${changes}${baseVersion ? ` · AGAINST BASE v${baseVersion}` : ''}${forClause(plan.referent)}`;
}

/** The op's mark against the plan it replaced (M2-6); null for a PLAN. */
export const markOf = (plan: ScorePlan, i: number): ScoreOpMark | null => plan.since?.marks[i]?.mark ?? null;

/** `SINCE PLAN 1 · 1 CHANGED · 1 SAME · 1 REMOVED` (zero counts left out); null for a PLAN. */
export function sinceLine(plan: ScorePlan): string | null {
  if (!plan.since) return null;
  const count = (m: ScoreOpMark) => plan.since!.marks.filter((x) => x.mark === m).length;
  const parts: Array<[number, string]> = [[count('NEW'), 'NEW'], [count('CHANGED'), 'CHANGED'], [count('SAME'), 'SAME'], [plan.since.removed.length, 'REMOVED']];
  const shown = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`);
  return [`SINCE PLAN ${revisionOf(plan) - 1}`, ...shown].join(' · ');
}

/** `REMOVED SINCE PLAN 1 · EDIT STYLE + jazz`, from the removed ops' row names and details; null when none. */
export function removedLine(plan: ScorePlan, rows: Array<{ name: string; detail: string }>): string | null {
  if (!plan.since?.removed.length) return null;
  return [`REMOVED SINCE PLAN ${revisionOf(plan) - 1}`, ...rows.map((r) => `${r.name} ${r.detail}`)].join(' · ');
}

/** The dimmed plan while REVISE runs (M2-7), not DT-5's "REPLACED". */
export const keptLabel = (plan: ScorePlan) => `PLAN ${revisionOf(plan)} · KEPT IF THE REVISE FAILS`;

/** REVISING's consequence line (frame 6). */
export const reviseConsequence = (plan: ScorePlan) =>
  `asks the planner with the plan above · uses the GPU for ~10 s · changes nothing yet · plan ${revisionOf(plan)} stays if this fails`;

/** The plan job's line while it is a REVISE: `REVISING… attempt 1 of 3 · plan 1 is kept if it fails`. */
export function reviseJobLine(line: string, plan: ScorePlan): string {
  const revising = line.replace(/^PLANNING/, 'REVISING');
  return revising === line || line.startsWith('PLANNING · QUEUED') ? revising : `${revising} · plan ${revisionOf(plan)} is kept if it fails`;
}

export const REVISE_FAILED_TITLE = 'REVISE FAILED';

/** Frame 8: the kept plan is still appliable. */
export const reviseFailedTail = (plan: ScorePlan) => {
  const n = revisionOf(plan);
  return `Plan ${n} is still here: change the request and REVISE, or APPLY & RENDER plan ${n}.`;
};

/** Frame 9: a fresh PLAN dropped the plan under review (D-028). */
export const DROPPED_BY_PLAN = 'The plan under review was dropped when PLAN started again; REVISE would have kept it.';

/** REVISE's tooltip while it is off. */
export const REVISE_OFF = 'change the request to revise the plan above';
