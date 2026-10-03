/**
 * In-memory job registry shared by every job type (generate, repaint, add-layer, …):
 * the Job record, lookup/registration, and the dev-facing abort.
 */
import fs from 'node:fs/promises';
import { abortRunning, cancelQueued, getRunning } from './genQueue.js';

export interface Job {
  id: string;
  taskId: string;
  /** `queued`: waiting in genQueue.ts for the running job to finish. */
  status: 'queued' | 'loading' | 'running' | 'done' | 'failed';
  error?: string;
  /** Set when the job left the queue without running (CANCEL, or its song was trashed):
   * the client drops it rather than offering RETRY. */
  cancelled?: boolean;
  songId?: string;
  createdAt: number;
  /** Last client read — the idle clock evictIdleJobs reads. Set by registerJob. */
  lastSeenAt?: number;
  /** Set by remasterJobs.ts on success; a scratch file path streamed once by remaster.ts's download route, then cleared. No other job type uses this. */
  resultPath?: string;
  /** Live progress from ACE-Step's /query_result while status is 'running' — see poll(). */
  progress?: number;
  progressStage?: string;
  progressText?: string;
  /** Set by transcribeJobs.ts on success: the score and what SheetSage2 reported. */
  transcription?: import('./transcribeJobs.js').TranscriptionOutcome;
  /** Set by lyricsJobs.ts on success: the words read from the source, with timings. */
  lyrics?: import('./lyricsJobs.js').LyricsOutcome;
  /** Set by analyzeJobs.ts on success: ACE-Step's description of the source. */
  analysis?: import('./acestep.js').FormatInputResult;
  /** Set by lmJobs.ts on success: what the LM wrote (FEELING LUCKY, Quick Start, WRITE FOR ME). */
  sample?: import('./acestep.js').SampleResult;
}

/** Readers stop once a job settles (a remaster is downloaded right then), so an hour
 * without one means nobody is coming back — see PLAN.md "Idle Jobs Leave Every Registry". */
export const JOB_IDLE_TTL_MS = 60 * 60 * 1000;

const jobs = new Map<string, Job>();

/** Look a job up for a client request, which also restarts its idle clock. */
export function getJob(id: string): Job | undefined {
  const job = jobs.get(id);
  if (job) job.lastSeenAt = Date.now();
  return job;
}

/** Register a job created elsewhere (e.g. repaintJobs.ts) so getJob() can find it. */
export function registerJob(job: Job): void {
  job.lastSeenAt = Date.now();
  jobs.set(job.id, job);
}

/** Whether a live job still owns this scratch file (a remaster result not yet downloaded). */
export function isLiveResultPath(filePath: string): boolean {
  return [...jobs.values()].some((j) => j.resultPath === filePath);
}

/** Drop every settled job unread for JOB_IDLE_TTL_MS, deleting a remaster result nobody
 * downloaded. A running job is never evicted: its own poll loop settles it. */
export async function evictIdleJobs(now = Date.now()): Promise<void> {
  const idle = [...jobs.values()].filter((j) => (j.status === 'done' || j.status === 'failed')
    && now - (j.lastSeenAt ?? j.createdAt) > JOB_IDLE_TTL_MS);
  for (const job of idle) jobs.delete(job.id);
  await Promise.all(idle.map((j) => (j.resultPath ? fs.rm(j.resultPath, { force: true }).catch(() => {}) : undefined)));
}

/**
 * Whether `job` was aborted since the caller last checked. A plain `job.status === 'failed'`
 * read works at runtime (another tick's abortJob call mutates the same object across an
 * `await`), but TS's control-flow narrowing doesn't know that and flags it as an impossible
 * comparison once a literal like `job.status = 'running'` appears earlier in the function —
 * routing the read through this helper sidesteps that narrowing.
 */
export function wasAborted(job: Job): boolean {
  return job.status === 'failed';
}

/** What a job that left the queue without running settles as (genQueue.ts's onCancel). */
export function settleCancelled(job: Job, reason: string): void {
  job.status = 'failed';
  job.error = reason;
  job.cancelled = true;
}

/** Marks a job aborted unless it already settled — genQueue.ts's onAbort for a queued Job. */
export function markAborted(job: Job): void {
  if (job.status === 'done' || job.status === 'failed') return;
  job.status = 'failed';
  job.error = 'Aborted';
}

/**
 * Dev-facing abort: marks a job failed so its body stops at its next `wasAborted()` check
 * (every job-start function registers its Job before its first await, so this catches the
 * model-load and submission window too). A queued job is simply taken out of the line. The
 * running job's slot stays held while its backend task drains (genQueue.ts's abortRunning):
 * ACE-Step has no cancel primitive, so the task keeps running there and its result is ignored.
 */
export function abortJob(jobId: string): boolean {
  if (cancelQueued(jobId)) return true;
  const job = jobs.get(jobId);
  if (!job || job.status === 'done' || job.status === 'failed') return false;
  markAborted(job);
  if (getRunning()?.jobId === jobId) abortRunning();
  return true;
}
