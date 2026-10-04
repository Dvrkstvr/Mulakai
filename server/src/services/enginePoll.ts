/**
 * The one poll loop for an extra engine's job (D-036): a new song's first take
 * (engineGenJobs.ts) and a score re-render (score/scoreRenderJob.ts) both wait here, so ABORT
 * drains the wrapper the same way for both.
 */
import { config } from '../config.js';
import { type Job, wasAborted } from './jobRegistry.js';
import { drainWhile, MAX_POLL_STRIKES } from './jobRunner.js';
import { cancel, status, type EngineJobState, type EngineTarget } from './engineClient.js';

/** Ask the wrapper to stop an aborted job, then hold the queue's slot until it has (drainWhile). */
export async function stopEngineJob(engine: EngineTarget, taskId: string): Promise<undefined> {
  await cancel(engine, taskId);
  await drainWhile(async () => (await status(engine, taskId)).state === 'running');
  return undefined;
}

/**
 * Polls until the wrapper reports a terminal state. Resolves with the finished state,
 * or undefined once the job was aborted on our side (see jobRegistry.ts's abortJob) — in which
 * case the wrapper is asked, best-effort, to stop too. Throws on a failed job.
 */
export async function pollEngine(job: Job, engine: EngineTarget): Promise<EngineJobState | undefined> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (job.status !== 'running') {
      return stopEngineJob(engine, job.taskId);
    }
    let state: EngineJobState;
    try {
      state = await status(engine, job.taskId);
      strikes = 0;
    } catch (err) {
      // Same 3-strike rule as jobRunner.ts's poll(): one flaky status call must not kill a long
      // GPU run, but a wedged wrapper must not hold the queue's slot forever either.
      if (++strikes < MAX_POLL_STRIKES) continue;
      throw err;
    }
    if (wasAborted(job)) {
      return stopEngineJob(engine, job.taskId);
    }
    if (state.state === 'failed') throw new Error(state.error ?? `${engine.label} generation failed`);
    if (state.state === 'done') return state;
    job.progress = state.progress;
    job.progressStage = state.stage;
  }
}
