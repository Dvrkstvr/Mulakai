/**
 * Song creation on an extra engine (PLAN.md "Multiple Song-Creation Engines", design
 * point 5): submit -> poll -> fetch audio + score -> insertGeneratedSong. Shares jobs.ts's
 * Job registry and the `generate` queue kind with ACE-Step's own startGeneration, but polls
 * the shared wrapper contract (engineClient.ts) instead of ACE-Step's query_result.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, queueJob, wasAborted, drainWhile, MAX_POLL_STRIKES } from './jobs.js';
import type { GenTask } from './genQueue.js';
import { submit, status, fetchAudio, fetchScore, cancel, type EngineJobState } from './engineClient.js';
import { insertGeneratedSong } from './songPersist.js';
import type { CreateFields, SongEngine } from './engines/types.js';

export const TRUNCATED_LABEL = 'first generation (truncated)';

/** A melody cover from a supplied score (PLAN.md "Mulakai server cover decisions"): the
 * engine's toCoverRequest builds the request, and the song is recorded as `cover`. */
export interface EngineCover {
  abc: string;
  /** What the score was transcribed from, e.g. a library song's title or a file name. */
  source: string;
}

/** Ask the wrapper to stop an aborted job, then hold the queue's slot until it has (drainWhile). */
async function stopEngineJob(engine: SongEngine, taskId: string): Promise<undefined> {
  await cancel(engine, taskId);
  await drainWhile(async () => (await status(engine, taskId)).state === 'running');
  return undefined;
}

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
      return stopEngineJob(engine, job.taskId);
    }
    let state: EngineJobState;
    try {
      state = await status(engine, job.taskId);
      strikes = 0;
    } catch (err) {
      // Same 3-strike rule as jobs.ts's poll(): one flaky status call must not kill a long
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

async function persistEngineSong(
  engine: SongEngine, taskId: string, fields: CreateFields, request: Record<string, unknown>,
  truncated: boolean, title: string, folderId?: string | null, cover?: EngineCover,
): Promise<string> {
  const audio = await fetchAudio(engine, taskId);
  // The score is optional garnish (metadata + a sidecar): losing it must not lose the song.
  const score = await fetchScore(engine, taskId).catch(() => null);
  const meta = engine.readMeta(score ? { score } : {});
  // Create names at the top level (the Editor's history row reads `prompt`), the exact
  // wire body under `request` — see PLAN.md "Framework decisions". A cover's `request.abc`
  // is the supplied score REUSE PROMPT reopens; the sidecar is what the engine sang.
  const task: GenTask = cover ? 'cover' : 'text2music';
  const params = { ...fields, engine: engine.id, task_type: task, request, ...(cover ? { source: cover.source } : {}) };
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

/** Queue a new-song generation on an extra engine and persist the result as a new song
 * with a base layer. Throws QueueFullError synchronously when the queue is full; throws
 * before queueing if `cover` is given to an engine that can't cover. */
export function startEngineGeneration(
  engine: SongEngine, fields: CreateFields, title: string, folderId?: string | null, cover?: EngineCover,
): Job {
  if (cover && !engine.toCoverRequest) throw new Error(`${engine.label} cannot cover a score`);
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  const task: GenTask = cover ? 'cover' : 'text2music';
  return queueJob({ kind: 'generate', title, caption: fields.prompt, task, engine: engine.id }, job, async () => {
    const request = cover ? engine.toCoverRequest!(fields, cover.abc) : engine.toRequest(fields);
    const taskId = await submit(engine, request, job.id);
    job.taskId = taskId;
    if (wasAborted(job)) {
      // aborted while the wrapper was accepting the submission
      await stopEngineJob(engine, taskId);
      return;
    }
    job.status = 'running';
    const finished = await pollEngine(job, engine);
    if (!finished) return;
    job.songId = await persistEngineSong(engine, taskId, fields, request, finished.truncated, title, folderId, cover);
    job.status = 'done';
  });
}
