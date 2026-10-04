import { AIGeneratingBackground } from './AIGeneratingBackground';
import { DockCommit } from './DockCommit';
import { useElapsedMs } from './genProgress';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { ScorePlanList } from './ScorePlanList';
import { ScoreStateLine } from './ScoreStateLine';
import {
  APPLY_OFF, ASKING_CONSEQUENCE, CHECK_FAILED_CONSEQUENCE, consequenceLine, jobLine, readingLine, REQUEST_PLACEHOLDER,
} from './scoreCopy';
import { useScoreStore } from './scoreStore';
import { canPlan, canRender } from './scoreVerb';
import type { ScoreVerbState } from './scoreVerbTypes';

interface Props {
  songId: string;
  state: ScoreVerbState;
}

/**
 * SCORE (pipeline/design/score-verb.html, DESIGN.md "Action dock › SCORE"): the reading, the
 * request field, the change list and checks once planned, then PLAN (acid outline) beside APPLY
 * & RENDER, the only acid fill. The plan and render jobs are a line under the commit: dashed while
 * queued, on the plain AI shader (no veil: YuE2 reports a stage's share) while the GPU works.
 * The dock grows with the plan (DT-1 A).
 */
export function DockScore({ songId, state }: Props) {
  const ahead = useJobsAhead();
  const { dispatch, plan, cancel, recheck, apply } = useScoreStore.getState();
  const { phase, status, request } = state;
  const elapsed = useElapsedMs(phase.kind === 'rendering', phase.kind === 'rendering' ? phase.startedAt : null);
  const onRecheck = () => void recheck(songId);
  if (phase.kind === 'hidden') return null;
  if (phase.kind === 'ineligible' || phase.kind === 'offline') {
    return <div className="dock-body"><ScoreStateLine phase={phase} onRecheck={onRecheck} onPlanAgain={() => {}} onRetryRender={() => {}} /></div>;
  }

  const rendering = phase.kind === 'renderQueued' || phase.kind === 'rendering';
  const waiting = phase.kind === 'queued' || phase.kind === 'planning';
  const locked = waiting || rendering;
  const ready = canRender(state);
  const shownPlan = state.plan && phase.kind !== 'done';
  // Its own plan or render is not a job ahead of it.
  const consequence = state.plan && (ready || rendering) ? consequenceLine(state.plan, status ?? {}, rendering ? 0 : ahead)
    : phase.kind === 'checkFailed' ? CHECK_FAILED_CONSEQUENCE
      : ASKING_CONSEQUENCE + (waiting ? '' : queueSuffix(ahead));
  const onPlan = () => void plan(songId);
  const working = (phase.kind === 'planning' && !phase.cancelling) || phase.kind === 'rendering';

  return (
    <>
      <div className="dock-body">
        <input
          className={locked ? 'dock-prompt score-locked' : 'dock-prompt'}
          aria-label="Score change request"
          placeholder={REQUEST_PLACEHOLDER}
          value={request}
          readOnly={locked}
          onChange={(e) => dispatch(songId, { type: 'edit', request: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && canPlan(state)) onPlan(); }}
        />
        {status?.reading && !waiting && <div className="score-reading">{readingLine(status.reading)}</div>}
        {shownPlan && state.plan && (
          <ScorePlanList plan={state.plan} baseStyle={status?.style ?? null} fromBpm={status?.reading?.bpm ?? null}
            baseVersion={status?.baseVersion} dimmed={phase.kind === 'stale' ? 'stale' : undefined} />
        )}
        {waiting && state.previous && (
          <ScorePlanList plan={state.previous} baseStyle={status?.style ?? null} fromBpm={status?.reading?.bpm ?? null} baseVersion={status?.baseVersion} dimmed="replacing" />
        )}
        <ScoreStateLine phase={phase} onRecheck={onRecheck} onPlanAgain={onPlan} onRetryRender={() => void apply(songId)} />
      </div>
      <DockCommit
        consequence={consequence}
        label="APPLY & RENDER"
        disabled={!ready}
        title={ready ? undefined : APPLY_OFF}
        onCommit={() => void apply(songId)}
        siblings={phase.kind === 'stale' ? undefined : ( // stale offers PLAN AGAIN on its own line (frame 14)
          <button type="button" className="acid-outline dock-commit-btn" disabled={!canPlan(state)} onClick={onPlan}>
            <span>PLAN</span>
          </button>
        )}
      />
      {(waiting || rendering) && (
        <div className="dock-jobs">
          <div className={working ? 'dock-job score-job' : 'dock-job score-job waiting'}>
            {working && <AIGeneratingBackground />}
            <span className="dock-job-label">{jobLine(phase, elapsed)}</span>
            {!(phase.kind === 'planning' && phase.cancelling) && (
              <button type="button" className="tab dock-quiet score-job-cancel" onClick={() => void cancel(songId)}><span>CANCEL</span></button>
            )}
          </div>
        </div>
      )}
      {state.error && <div className="error">{state.error}</div>}
    </>
  );
}
