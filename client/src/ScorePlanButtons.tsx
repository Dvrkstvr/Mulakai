import { REVISE_OFF } from './scoreCopy';
import { canPlan, canRevise } from './scoreVerb';
import type { ScoreVerbState } from './scoreVerbTypes';

interface Props {
  state: ScoreVerbState;
  onPlan: () => void;
  onRevise: () => void;
}

/** PLAN and, while a plan is under review or being revised, REVISE beside it (M2-5, Q-042 A): two acid
 * outlines left of APPLY & RENDER, the only fill. PLAN starts again from the song; REVISE changes the plan
 * above and is off while the request is the one that plan was made for. */
export function ScorePlanButtons({ state, onPlan, onRevise }: Props) {
  const revisable = state.plan !== null || (state.revising && state.previous !== null);
  const revise = canRevise(state);
  return (
    <>
      <button type="button" className="acid-outline dock-commit-btn" disabled={!canPlan(state)} onClick={onPlan}>
        <span>PLAN</span>
      </button>
      {revisable && (
        <button type="button" className="acid-outline dock-commit-btn" disabled={!revise} title={revise ? undefined : REVISE_OFF} onClick={onRevise}>
          <span>REVISE</span>
        </button>
      )}
    </>
  );
}
