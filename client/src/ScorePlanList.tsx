import type { ScorePlan } from './api';
import { ScoreLyricDiff } from './ScoreLyricDiff';
import { checksSegments, opRows, planHeader, PREVIOUS_PLAN, refusedLines, rowDetail } from './scoreCopy';

interface Props {
  plan: ScorePlan;
  /** The stored style and tempo the plan changes, for the row details. */
  baseStyle: string | null;
  fromBpm: number | null;
  /** The base's key, for TRANSPOSE's "Am → Gm" (M2). */
  fromKey?: string | null;
  baseVersion: number | null | undefined;
  /** 40%, dashed, unpressable, no checks: the plan a re-plan is replacing (labelled, DT-5), or the
   * one APPLY & RENDER refused as out of date. */
  dimmed?: 'replacing' | 'stale';
}

/** SCORE's change list (one row per op, its verdict and tag; under a REPEAT / CUT its lyric note,
 * under a REWRITE LYRICS its OLD / NEW diff, F-030 #3, F-031 #1), the one checks line, and a rust
 * line per earlier refused attempt (D-060). */
export function ScorePlanList({ plan, baseStyle, fromBpm, fromKey = null, baseVersion, dimmed }: Props) {
  const list = (
    <div className="score-ops">
      {opRows(plan, baseStyle, fromBpm, fromKey).map((row, i) => (
        <div key={i} className={row.ok ? 'score-op' : 'score-op no'}>
          <span className="score-verdict" aria-label={row.ok ? 'passes' : 'rejected'}>{row.ok ? '✓' : '✕'}</span>
          <span className="score-op-name">{row.name}</span>
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
        {dimmed === 'replacing' && <div className="dock-row-label score-plan-label">{PREVIOUS_PLAN}</div>}
        <div className="score-dimmed" aria-disabled="true">{list}</div>
      </>
    );
  }
  return (
    <>
      <div className="dock-row-label score-plan-label">{planHeader(plan, baseVersion)}</div>
      {list}
      <div className="score-checks">
        {checksSegments(plan.checks, plan.attempts).map((seg, i) => (
          <span key={i}>{i > 0 && ' · '}<span className={seg.warn ? 'warn' : undefined}>{seg.text}</span></span>
        ))}
      </div>
      {refusedLines(plan).map((line, i) => <div key={i} className="score-refused">{line}</div>)}
    </>
  );
}
