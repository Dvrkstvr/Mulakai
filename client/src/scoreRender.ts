/**
 * APPLY & RENDER's job, as the SCORE verb sees it (F-023): one server answer → one reducer event
 * (`renderEvent`, pure), and the poll that feeds them while a render is queued or running. A render
 * survives a reload: SCORE reopening finds it through GET …/score/render and follows it again.
 */
import { api, type ScoreRenderRun } from './api';
import { renderStage, savedLine, SERVER_GONE } from './scoreCopy';
import type { ScoreEvent } from './scoreVerbTypes';
import { POLL_MS } from './transcribeStore';

/** Failed polls in a row before the dock stops waiting on a server that is gone. */
const MAX_POLL_STRIKES = 5;

export function renderEvent(run: ScoreRenderRun): ScoreEvent {
  if (run.version) return { type: 'renderDone', saved: savedLine(run.version), truncated: run.version.truncated };
  if (run.status === 'queued') return { type: 'renderProgress', ahead: run.queuePosition ?? 1, line: '', startedAt: null };
  if (run.status === 'loading' || run.status === 'running') {
    return { type: 'renderProgress', ahead: 0, line: renderStage(run.stage, run.progress), startedAt: run.startedAt ?? null };
  }
  if (run.cause === 'refused') return { type: 'renderRefused', reason: run.error ?? 'the song changed since the plan' };
  if (run.cause === 'cancelled') return { type: 'renderCancelled' };
  return { type: 'renderFailed', error: run.error ?? 'the render failed' };
}

const inFlight = (run: ScoreRenderRun | null): run is ScoreRenderRun => !!run && ['queued', 'loading', 'running'].includes(run.status);

/** A render still queued or running for this song (SCORE reopened mid-render), else null. */
export async function renderInFlight(songId: string): Promise<ScoreRenderRun | null> {
  const { run } = await api.scoreRenderState(songId);
  return inFlight(run) ? run : null;
}

/** Feeds the render's state to the reducer until `following()` says it is no longer rendering. */
export async function followRender(songId: string, dispatch: (e: ScoreEvent) => void, following: () => boolean): Promise<void> {
  let strikes = 0;
  while (following()) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const { run } = await api.scoreRenderState(songId);
      strikes = 0;
      dispatch(run ? renderEvent(run) : { type: 'renderFailed', error: SERVER_GONE });
    } catch {
      if (++strikes >= MAX_POLL_STRIKES) dispatch({ type: 'renderFailed', error: SERVER_GONE });
    }
  }
}
