import type { ScorePlan } from './api';
import { chatRemovedLine, chatSinceLine } from './chatReviseCopy';
import { ScoreLyricDiff } from './ScoreLyricDiff';
import { checksSegments, keptLabel, markOf, opRows, planTitle, PREVIOUS_PLAN, refusedLines, removedLine, rowDetail, sinceLine } from './scoreCopy';

interface Props {
  plan: ScorePlan;
  /** The stored style and tempo the plan changes, for the row details. */
  baseStyle: string | null;
  fromBpm: number | null;
  /** The base's key, for TRANSPOSE's "Am → Gm" (M2). */
  fromKey?: string | null;
  baseVersion: number | null | undefined;
  /** 40%, dashed, unpressable, no checks: the plan a re-plan is replacing (labelled, DT-5), the one a REVISE
   * keeps if it fails (M2-7), or the one APPLY & RENDER refused as out of date. */
  dimmed?: 'replacing' | 'kept' | 'stale';
  /** The chat's edit card (F-060, Q-143): a row reports its index on hover and keyboard focus, null on leave, so the
   * bar map lights that op's bars. Absent (the dock): rows are plain, not focusable. */
  onHoverRow?: (index: number | null) => void;
  /** The chat's edit card (D-229): its own SINCE and `REMOVED (n)` lines; `untitled` = the card's header carries the plan
   * title. The dock leaves both unset and keeps its wording. */
  chat?: { untitled: boolean };
}

/** SCORE's change list (one row per op, its verdict, a REVISE's NEW / CHANGED / SAME mark and its tag; under a
 * REPEAT / CUT its lyric note, under a REWRITE LYRICS its OLD / NEW diff, F-030 #3, F-031 #1), the ops a REVISE
 * removed (M2-6), the one checks line, and a rust line per earlier refused attempt (D-060). */
export function ScorePlanList({ plan, baseStyle, fromBpm, fromKey = null, baseVersion, dimmed, onHoverRow, chat }: Props) {
  const since = dimmed ? null : chat && plan.since ? chatSinceLine(plan.since, plan.revision) : sinceLine(plan);
  const hover = (i: number) => (onHoverRow ? {
    tabIndex: 0, onMouseEnter: () => onHoverRow(i), onMouseLeave: () => onHoverRow(null), onFocus: () => onHoverRow(i), onBlur: () => onHoverRow(null),
  } : {});
  const removedRows = opRows({ ...plan, ops: plan.since?.removed ?? [], verdicts: [] }, baseStyle, fromBpm, fromKey);
  const removed = dimmed ? null : chat ? chatRemovedLine(removedRows) : removedLine(plan, removedRows);
  const list = (
    <div className="score-ops">
      {opRows(plan, baseStyle, fromBpm, fromKey).map((row, i) => (
        <div key={i} className={row.ok ? 'score-op' : 'score-op no'} {...hover(i)}>
          <span className="score-verdict" aria-label={row.ok ? 'passes' : 'rejected'}>{row.ok ? '✓' : '✕'}</span>
          <span className="score-op-name">{row.name}</span>
          {plan.since && <span className={markOf(plan, i) === 'SAME' ? 'score-op-mark' : 'score-op-mark hi'}>{markOf(plan, i)}</span>}
          <span className="score-op-detail">{rowDetail(row)}</span>
          {row.ok && <span className="score-op-tag">{row.tag}</span>}
          {row.note && <div className="score-op-note">{row.note}</div>}
          {row.diff && <ScoreLyricDiff diff={row.diff} baseVersion={baseVersion} />}
        </div>
      ))}
    </div>
  );
  if (dimmed) {
    return (
      <>
        {dimmed !== 'stale' && <div className="dock-row-label score-plan-label">{dimmed === 'kept' ? keptLabel(plan) : PREVIOUS_PLAN}</div>}
        <div className="score-dimmed" aria-disabled="true">{list}</div>
      </>
    );
  }
  return (
    <>
      {!chat?.untitled && <div className="dock-row-label score-plan-label">{planTitle(plan, baseVersion)}</div>}
      {since && <div className="score-since">{since}</div>}
      {list}
      {removed && <div className="score-since">{removed}</div>}
      <div className="score-checks">
        {checksSegments(plan.checks, plan.attempts, plan.renderMode).map((seg, i) => (
          <span key={i}>{i > 0 && ' · '}<span className={seg.warn ? 'warn' : undefined}>{seg.text}</span></span>
        ))}
      </div>
      {refusedLines(plan).map((line, i) => <div key={i} className="score-refused">{line}</div>)}
    </>
  );
}
