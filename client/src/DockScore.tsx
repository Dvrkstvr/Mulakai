import { AIGeneratingBackground } from './AIGeneratingBackground';
import { DockCommit } from './DockCommit';
import { useElapsedMs } from './genProgress';
import { useJobsAhead } from './queueStore';
import { ScoreFailure } from './ScoreFailure';
import { ScorePlanButtons } from './ScorePlanButtons';
import { ScorePlanList } from './ScorePlanList';
import { ScoreStaleSelection } from './ScoreStaleSelection';
import { ScoreStateLine } from './ScoreStateLine';
import { APPLY_OFF, fillRequest, movedOnNote, readingLine, REVISE_FAILED_TITLE, reviseFailedTail } from './scoreCopy';
import { dockLines, isRendering, isWaiting } from './scoreDockLines';
import { useScoreStore } from './scoreStore';
import { canPlan, canRender, canRevise } from './scoreVerb';
import type { ScoreVerbState } from './scoreVerbTypes';

interface Props {
  songId: string;
  state: ScoreVerbState;
}

/**
 * SCORE (pipeline/design/score-verb.html, score-m2.html; DESIGN.md "Action dock › SCORE"): the reading, the
 * request field, the change list and checks once planned, then PLAN and REVISE (acid outlines) beside APPLY &
 * RENDER, the only acid fill. The plan and render jobs are a line under the commit: dashed while queued, on the
 * plain AI shader (no veil: YuE2 reports a stage's share) while the GPU works. The dock grows with the plan (DT-1 A).
 */
export function DockScore({ songId, state }: Props) {
  const ahead = useJobsAhead();
  const { dispatch, plan, revise, cancel, recheck, apply } = useScoreStore.getState();
  const { phase, status, request } = state;
  const elapsed = useElapsedMs(phase.kind === 'rendering', phase.kind === 'rendering' ? phase.startedAt : null);
  const onRecheck = () => void recheck(songId);
  if (phase.kind === 'hidden') return null;
  if (phase.kind === 'ineligible' || phase.kind === 'offline') {
    return <div className="dock-body"><ScoreStateLine phase={phase} onRecheck={onRecheck} onPlanAgain={() => {}} onRetryRender={() => {}} /></div>;
  }

  const rendering = isRendering(state);
  const waiting = isWaiting(state);
  const ready = canRender(state);
  const shownPlan = state.plan && phase.kind !== 'done';
  const lines = dockLines(state, ahead, elapsed);
  const onPlan = () => void plan(songId);
  const onRevise = () => void revise(songId);
  const onFill = (words: string) => dispatch(songId, { type: 'edit', request: fillRequest(request, words) });
  const working = (phase.kind === 'planning' && !phase.cancelling) || phase.kind === 'rendering';
  const listProps = { baseStyle: status?.style ?? null, fromBpm: status?.reading?.bpm ?? null, fromKey: status?.reading?.key ?? null, baseVersion: status?.baseVersion };
  const moved = shownPlan && state.plan ? movedOnNote(state.plan, state.pick) : null;

  return (
    <>
      <div className="dock-body">
        <input
          className={waiting || rendering ? 'dock-prompt score-locked' : 'dock-prompt'}
          aria-label="Score change request"
          placeholder={lines.placeholder}
          value={request}
          readOnly={waiting || rendering}
          onChange={(e) => dispatch(songId, { type: 'edit', request: e.target.value })}
          // Enter revises when REVISE is on, else plans (M2-5).
          onKeyDown={(e) => { if (e.key === 'Enter') { if (canRevise(state)) onRevise(); else if (canPlan(state)) onPlan(); } }}
        />
        {status?.reading && !waiting && <div className="score-reading">{readingLine(status.reading)}</div>}
        {shownPlan && state.plan && <ScorePlanList plan={state.plan} {...listProps} dimmed={phase.kind === 'stale' ? 'stale' : undefined} />}
        {moved && <div className="score-since">{moved}</div>}
        {waiting && state.previous && <ScorePlanList plan={state.previous} {...listProps} dimmed={state.revising ? 'kept' : 'replacing'} />}
        {state.stale && !waiting && (
          <ScoreStaleSelection stale={state.stale} onWhole={() => dispatch(songId, { type: 'pick', pick: null })}
            onUse={() => dispatch(songId, { type: 'pick', pick: state.stale?.now ?? null })} />
        )}
        {state.reviseFailed && state.plan && (
          <ScoreFailure title={REVISE_FAILED_TITLE} reasons={state.reviseFailed} tail={reviseFailedTail(state.plan)} onFill={onFill} />
        )}
        <ScoreStateLine phase={phase} onRecheck={onRecheck} onPlanAgain={onPlan} onRetryRender={() => void apply(songId)} onFill={onFill} />
      </div>
      <DockCommit
        consequence={lines.consequence}
        label="APPLY & RENDER"
        disabled={!ready}
        title={ready ? undefined : APPLY_OFF}
        onCommit={() => void apply(songId)}
        // stale offers PLAN AGAIN on its own line (frame 14)
        siblings={phase.kind === 'stale' ? undefined : <ScorePlanButtons state={state} onPlan={onPlan} onRevise={onRevise} />}
      />
      {(waiting || rendering) && (
        <div className="dock-jobs">
          <div className={working ? 'dock-job score-job' : 'dock-job score-job waiting'}>
            {working && <AIGeneratingBackground />}
            <span className="dock-job-label">{lines.job}</span>
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
