/**
 * Song creation on an extra engine (PLAN.md "Multiple Song-Creation Engines", design
 * point 5): submit -> poll -> fetch audio + score -> insertGeneratedSong. Shares jobs.ts's
 * Job registry and the `generate` genLock with ACE-Step's own startGeneration, but polls
 * the shared wrapper contract (engineClient.ts) instead of ACE-Step's query_result.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, registerJob, run, wasAborted, MAX_POLL_STRIKES } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { submit, status, fetchAudio, fetchScore, cancel, type EngineJobState } from './engineClient.js';
import { insertGeneratedSong } from './songPersist.js';
import type { CreateFields, SongEngine } from './engines/types.js';

export const TRUNCATED_LABEL = 'first generation (truncated)';

/**
 * Polls until the wrapper reports a terminal state. Resolves with the finished state,
 * or undefined once the job was aborted on our side (see jobs.ts's abortJob) — in which
 * case the wrapper is asked, best-effort, to stop too. Throws on a failed job.
 */
async function pollEngine(job: Job, engine: SongEngine): Promise<EngineJobState | undefined> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (job.status !== 'running') {
      void cancel(engine, job.taskId);
      return undefined;
    }
    let state: EngineJobState;
    try {
      state = await status(engine, job.taskId);
      strikes = 0;
    } catch (err) {
      // Same 3-strike rule as jobs.ts's poll(): one flaky status call must not kill a long
      // GPU run, but a wedged wrapper must not hold the genLock forever either.
      if (++strikes < MAX_POLL_STRIKES) continue;
      throw err;
    }
    if (wasAborted(job)) {
      void cancel(engine, job.taskId);
      return undefined;
    }
    if (state.state === 'failed') throw new Error(state.error ?? `${engine.label} generation failed`);
    if (state.state === 'done') return state;
    job.progress = state.progress;
    job.progressStage = state.stage;
  }
}

async function persistEngineSong(
  engine: SongEngine, taskId: string, fields: CreateFields, request: Record<string, unknown>,
  truncated: boolean, title: string, folderId?: string | null,
): Promise<string> {
  const audio = await fetchAudio(engine, taskId);
  // The score is optional garnish (metadata + a sidecar): losing it must not lose the song.
  const score = await fetchScore(engine, taskId).catch(() => null);
  const meta = engine.readMeta(score ? { score } : {});
  // Create names at the top level (the Editor's history row reads `prompt`), the exact
  // wire body under `request` — see PLAN.md "Framework decisions".
  const params = { ...fields, engine: engine.id, task_type: 'text2music', request };
  return insertGeneratedSong({
    audio,
    meta: {
      caption: fields.prompt ?? '',
      lyrics: fields.lyrics ?? '',
      ...meta,
      duration: null,
      seed: typeof request.seed === 'number' ? String(request.seed) : '',
    },
    params,
    lyricTimestamps: null,
    title,
    folderId,
    engine: engine.id,
    label: truncated ? TRUNCATED_LABEL : undefined,
    score,
  });
}

/** Submit a new-song generation to an extra engine and persist the result as a new song
 * with a base layer. Throws GenLockError synchronously if another generation is running. */
export function startEngineGeneration(engine: SongEngine, fields: CreateFields, title: string, folderId?: string | null): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: fields.prompt, task: 'text2music', engine: engine.id });
  registerJob(job);
  void run(job, async () => {
    const request = engine.toRequest(fields);
    const taskId = await submit(engine, request, job.id);
    job.taskId = taskId;
    if (wasAborted(job)) {
      // aborted while the wrapper was accepting the submission
      void cancel(engine, taskId);
      return;
    }
    job.status = 'running';
    const finished = await pollEngine(job, engine);
    if (!finished) return;
    job.songId = await persistEngineSong(engine, taskId, fields, request, finished.truncated, title, folderId);
    job.status = 'done';
  }).finally(() => releaseGenLock(job.id));
  return job;
}
