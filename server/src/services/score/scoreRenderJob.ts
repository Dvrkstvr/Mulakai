/**
 * APPLY & RENDER (F-023): queue kind `scoreRender`, its own GPU slot (the review never holds one).
 * When its turn comes it re-checks the song (scoreRenderCheck; a refusal starts no engine job), then
 * sends the edited score to YuE2 (yue2Score), polls like a first take (enginePoll, D-036), and saves
 * the result as a new base version (scoreVersion). A failed render saves nothing and keeps the plan
 * for RETRY RENDER; CANCEL is ABORT: the slot is held while YuE2 drains, and no version is made.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { fetchAudio, fetchScore, submit, type EngineTarget } from '../engineClient.js';
import { pollEngine, stopEngineJob } from '../enginePoll.js';
import { yue2Engine } from '../engines/yue2.js';
import { buildYue2ScoreRequest } from '../engines/yue2Score.js';
import { getQueued, getRunning } from '../genQueue.js';
import { ABORTED_AFTER_SAVE, queueJob } from '../jobRunner.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import { songTitle } from '../queueGuards.js';
import { loadedModels, type LoadedModel } from './ollamaControl.js';
import type { Plan } from './planTypes.js';
import { dropPlan, getPlanById, noteRender, type RenderRun } from './planStore.js';
import { renderRefusal } from './scoreRenderCheck.js';
import type { ScoreSource } from './scoreSource.js';
import { scoreStatus, type ScoreStatus } from './scoreStatus.js';
import { persistScoreVersion } from './scoreVersion.js';

export interface RenderDeps {
  target: EngineTarget;
  status: (songId: string) => Promise<ScoreStatus>;
  /** The planner's `/api/ps`. */
  loaded: () => Promise<LoadedModel[]>;
}

export function renderDeps(over: Partial<RenderDeps> = {}): RenderDeps {
  return {
    target: yue2Engine,
    status: (songId) => scoreStatus(songId),
    loaded: () => loadedModels({ url: config.llmUrl, model: config.llmModel }),
    ...over,
  };
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** An edit on this song that is queued or running (SCORE's own jobs aside), by what it does. */
function pendingEdit(songId: string): string | null {
  const job = [getRunning(), ...getQueued()].find((j) => j?.songId === songId && j.kind !== 'plan' && j.kind !== 'scoreRender');
  return job ? job.label ?? job.kind : null;
}

/** A refusal is `stale` when the plan is out of date; a GPU refusal is not (D-054). */
export type Checked = { refusal: string; stale: boolean } | { plan: Plan; source: ScoreSource };

/** The re-check's facts, gathered now. `atClick` adds "an edit was queued after this plan": once the
 * render waits its turn, an edit queued behind it runs after it, on the new version. */
export async function checkRender(songId: string, planId: string, deps: RenderDeps, atClick: boolean): Promise<Checked> {
  const status = await deps.status(songId);
  const plan = getPlanById(planId);
  const loaded = await deps.loaded().catch((err: unknown) => ({ error: message(err) }));
  const refusal = renderRefusal({
    songId, eligibility: status.eligibility, plan, source: status.source, pendingEdit: atClick ? pendingEdit(songId) : null, loaded,
  });
  if (refusal) return { refusal: refusal.reason, stale: refusal.kind === 'plan' };
  if (!plan || !status.source) return { refusal: 'SCORE is not available for this song', stale: true };
  return { plan, source: status.source };
}

/** Queues the render of `planId`; the caller ran checkRender at the click. Throws QueueFullError. */
export function startScoreRender(songId: string, planId: string, deps: RenderDeps = renderDeps()): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now(), songId };
  const run: RenderRun = { jobId: job.id, planId, refused: null, version: null };
  noteRender(songId, run);
  return queueJob({ kind: 'scoreRender', songId, title: songTitle(songId), label: 'score render' }, job, async () => {
    const checked = await checkRender(songId, planId, deps, false);
    if ('refusal' in checked) {
      run.refused = checked.refusal;
      throw new Error(checked.refusal);
    }
    const { plan, source } = checked;
    // A plan's edited lyrics (REPEAT / CUT / REWRITE_LYRICS) when it has them, else the base's as stored.
    const lyrics = plan.lyrics ?? source.lyrics ?? '';
    const request = buildYue2ScoreRequest({ abc: plan.abc, style: plan.style, lyrics, seed: source.seed ?? 0 });
    const taskId = await submit(deps.target, { ...request }, job.id);
    job.taskId = taskId;
    if (wasAborted(job)) {
      await stopEngineJob(deps.target, taskId); // CANCEL landed while YuE2 was accepting the job
      return;
    }
    job.status = 'running';
    const finished = await pollEngine(job, deps.target);
    if (!finished) return;
    const audio = await fetchAudio(deps.target, taskId);
    const score = await fetchScore(deps.target, taskId).catch(() => null);
    if (wasAborted(job)) return; // CANCEL after YuE2 finished but before the save: still no version
    run.version = await persistScoreVersion({ songId, plan, source, request, audio, score, truncated: finished.truncated });
    dropPlan(songId);
    if (wasAborted(job)) {
      job.error = ABORTED_AFTER_SAVE; // a save in progress cannot be taken back
      return;
    }
    job.status = 'done';
  });
}
