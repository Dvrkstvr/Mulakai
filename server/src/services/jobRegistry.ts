/**
 * In-memory job registry shared by every job type (generate, repaint, add-layer, …):
 * the Job record, lookup/registration, and the dev-facing abort.
 */
import { releaseGenLock } from './genLock.js';

export interface Job {
  id: string;
  taskId: string;
  status: 'loading' | 'running' | 'done' | 'failed';
  error?: string;
  songId?: string;
  createdAt: number;
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
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Register a job created elsewhere (e.g. repaintJobs.ts) so getJob() can find it. */
export function registerJob(job: Job): void {
  jobs.set(job.id, job);
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

/**
 * Dev-facing abort: marks a job failed so `poll()` stops on its next tick and
 * releases the generation lock immediately, so the UI unblocks right away. Also
 * catches a job still in its pre-registration `run()` body (see repaintJobs.ts
 * etc.'s `wasAborted()` checks after each await) — every job-start function
 * registers its Job synchronously before its first await specifically so this
 * has something to mark right away, not just once polling begins.
 * The underlying ACE-Step task keeps running server-side (no cancel primitive
 * exists there, same caveat as stemSplit.ts's cancelSplit) — its eventual
 * result is simply ignored since `poll()` has already returned.
 */
export function abortJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  releaseGenLock(jobId);
  if (!job || job.status === 'done' || job.status === 'failed') return false;
  job.status = 'failed';
  job.error = 'Aborted';
  return true;
}
