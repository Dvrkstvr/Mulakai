import type { ScorePhase } from './scoreVerbTypes';
import {
  CHECK_FAILED_FIX, CHECK_FAILED_TITLE, fillLabel, limitHint, offlineLines, RENDER_FAILED_TAIL, RENDER_FAILED_TITLE, STALE_TAIL, STALE_TITLE,
} from './scoreCopy';

interface Props {
  phase: ScorePhase;
  onRecheck: () => void;
  onPlanAgain: () => void;
  onRetryRender: () => void;
  /** FILL: types the cut hint's words into the request field; sends nothing (Q-048). */
  onFill?: (words: string) => void;
}

/** SCORE's one-line states: the plain ineligible reason, and the rust ones with their fix
 * (PLANNER OFFLINE + RECHECK, CHECK FAILED with a cut hint's FILL, a stale plan + PLAN AGAIN, RENDER FAILED + RETRY
 * RENDER, TRUNCATED); a done render is a lilac line. */
export function ScoreStateLine({ phase, onRecheck, onPlanAgain, onRetryRender, onFill }: Props) {
  switch (phase.kind) {
    case 'ineligible':
      return <div className="score-reason">{phase.reason}</div>;
    case 'offline': {
      const { title, body, fix } = offlineLines(phase);
      return (
        <div className="score-error" role="alert">
          <div><b>{title}</b> · {body}<br />{fix}</div>
          <button type="button" className="tab dock-quiet" onClick={onRecheck}><span>RECHECK</span></button>
        </div>
      );
    }
    case 'checkFailed': {
      const hints = phase.reasons.map(limitHint);
      const fill = hints.find(Boolean)?.fill;
      return (
        <div className="score-error" role="alert">
          <div>
            <b>{CHECK_FAILED_TITLE}</b>
            {phase.reasons.map((r, i) => {
              const h = hints[i];
              return <div key={i}>{h ? <><b>{h.title}</b> · {h.body}</> : r}</div>;
            })}
            {CHECK_FAILED_FIX}
          </div>
          {fill && onFill && (
            <button type="button" className="tab dock-quiet" onClick={() => onFill(fill)}><span>{fillLabel(fill)}</span></button>
          )}
        </div>
      );
    }
    case 'stale':
      return (
        <div className="score-warn" role="alert">
          <div><b>{STALE_TITLE}</b> · {phase.reason}. {STALE_TAIL}</div>
          <button type="button" className="acid-outline" onClick={onPlanAgain}><span>PLAN AGAIN</span></button>
        </div>
      );
    case 'renderFailed':
      return (
        <div className="score-error" role="alert">
          <div><b>{RENDER_FAILED_TITLE}</b> · {phase.error} · {RENDER_FAILED_TAIL}</div>
          <button type="button" className="tab dock-quiet" onClick={onRetryRender}><span>RETRY RENDER</span></button>
        </div>
      );
    case 'done':
      return <div className={phase.truncated ? 'score-done truncated' : 'score-done'}>{phase.saved}</div>;
    default:
      return null;
  }
}
