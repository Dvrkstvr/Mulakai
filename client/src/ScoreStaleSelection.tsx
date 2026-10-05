import type { ScoreStaleReferent } from './api';
import { STALE_SELECTION, WHOLE_SCORE_PICK, staleBody, staleRow, repickLabel } from './scoreCopy';

interface Props {
  stale: ScoreStaleReferent;
  /** USE BARS: re-pick where the picked section or block is now (the server's `now`, sent back as it is). */
  onUse: () => void;
  /** WHOLE SCORE: clear the pick. */
  onWhole: () => void;
}

/** A pick the score no longer has where it was (F-032 edge, M2-4, frame 4): never remapped. The rejected row says
 * nothing was planned against it; the rust line says where it is now and that nothing was applied, with USE BARS
 * (when it still exists) and WHOLE SCORE. APPLY & RENDER stays off meanwhile (scoreVerb.canRender). */
export function ScoreStaleSelection({ stale, onUse, onWhole }: Props) {
  const use = repickLabel(stale);
  return (
    <>
      <div className="score-ops">
        <div className="score-op no">
          <span className="score-verdict" aria-label="rejected">✕</span>
          <span className="score-op-name">THIS</span>
          <span className="score-op-detail">{staleRow(stale)}</span>
        </div>
      </div>
      <div className="score-warn" role="alert">
        <div><b>{STALE_SELECTION}</b> · {staleBody(stale)}</div>
        {use && <button type="button" className="acid-outline" onClick={onUse}><span>{use}</span></button>}
        <button type="button" className="tab dock-quiet" onClick={onWhole}><span>{WHOLE_SCORE_PICK}</span></button>
      </div>
    </>
  );
}
