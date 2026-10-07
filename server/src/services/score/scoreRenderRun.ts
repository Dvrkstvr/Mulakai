/**
 * The YuE2 leg of a score render (F-023), shared by APPLY & RENDER (scoreRenderJob) and the chat's
 * APPLY (chat/spliceRenderJob): the plan's edited score (and its edited lyrics, else the base's) →
 * submit → poll like a first take (enginePoll, D-036). Null once the job was aborted (the engine job
 * is stopped and drained first); throws when YuE2 fails. The caller fetches the audio when it needs it.
 */
import { submit, type EngineTarget } from '../engineClient.js';
import { pollEngine, stopEngineJob } from '../enginePoll.js';
import { buildYue2ScoreRequest, type ScoreRenderRequest } from '../engines/yue2Score.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import type { Plan } from './planTypes.js';
import type { ScoreSource } from './scoreSource.js';

export interface RenderedTake {
  /** YuE2's job id: its audio and score stay on yue-server until fetched. */
  taskId: string;
  truncated: boolean;
  request: ScoreRenderRequest;
}

/** What the render sends: the plan's score, style and lyrics, the base's seed, the plan's cot. */
export function scoreRequest(plan: Plan, source: ScoreSource): ScoreRenderRequest {
  // A plan's edited lyrics (REPEAT / CUT / REWRITE_LYRICS) when it has them, else the base's as stored.
  const lyrics = plan.lyrics ?? source.lyrics ?? '';
  return buildYue2ScoreRequest({ abc: plan.abc, style: plan.style, lyrics, seed: source.seed ?? 0, cot: plan.renderMode.cot });
}

export async function runScoreRender(job: Job, target: EngineTarget, plan: Plan, source: ScoreSource): Promise<RenderedTake | null> {
  const request = scoreRequest(plan, source);
  const taskId = await submit(target, { ...request }, job.id);
  job.taskId = taskId;
  if (wasAborted(job)) {
    await stopEngineJob(target, taskId); // CANCEL landed while YuE2 was accepting the job
    return null;
  }
  job.status = 'running';
  const finished = await pollEngine(job, target);
  if (!finished) return null;
  return { taskId, truncated: finished.truncated, request };
}
