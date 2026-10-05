/** What SCORE's dock body says for a state (DockScore): the field's placeholder, the consequence line before the
 * commit, and the job line under it, with a pick (F-032) and while a REVISE runs (F-033). Pure. */
import { queueSuffix } from './queueCopy';
import {
  ASKING_CONSEQUENCE, askingClause, CHECK_FAILED_CONSEQUENCE, consequenceLine, jobLine, pickPlaceholder, REQUEST_PLACEHOLDER,
  reviseConsequence, reviseJobLine,
} from './scoreCopy';
import { canRender } from './scoreVerb';
import type { ScoreVerbState } from './scoreVerbTypes';

export const isWaiting = (s: ScoreVerbState) => s.phase.kind === 'queued' || s.phase.kind === 'planning';
export const isRendering = (s: ScoreVerbState) => s.phase.kind === 'renderQueued' || s.phase.kind === 'rendering';

/** `ahead`: jobs ahead in the GPU queue (its own plan or render is not one of them). */
export function dockLines(s: ScoreVerbState, ahead: number, elapsedMs = 0) {
  const waiting = isWaiting(s);
  const rendering = isRendering(s);
  const kept = s.revising ? s.previous : null;
  const consequence = s.plan && (canRender(s) || rendering) ? consequenceLine(s.plan, s.status ?? {}, rendering ? 0 : ahead)
    : waiting && kept ? reviseConsequence(kept)
      : s.phase.kind === 'checkFailed' || s.stale ? CHECK_FAILED_CONSEQUENCE
        : ASKING_CONSEQUENCE + askingClause(s.pick) + (waiting ? '' : queueSuffix(ahead));
  const job = kept && waiting ? reviseJobLine(jobLine(s.phase, elapsedMs), kept) : jobLine(s.phase, elapsedMs);
  return { consequence, placeholder: pickPlaceholder(s.pick, REQUEST_PLACEHOLDER), job };
}
