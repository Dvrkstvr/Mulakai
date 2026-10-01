/** Job body execution and the ACE-Step /query_result poll loop shared by every job type. */
import { config } from '../config.js';
import { queryResult, type TaskResult } from './acestep.js';
import type { Job } from './jobRegistry.js';

/** Wrap an async job body so any thrown error marks the job failed. Exported for coverGenJobs.ts's cover-from-audio flow. */
export async function run(job: Job, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

// A single failed status poll must not kill a long GPU run (the generation itself is
// unaffected), but persistent failure — e.g. every request timing out against a wedged
// backend — has to fail the job eventually or the genLock is held forever.
export const MAX_POLL_STRIKES = 3;

export async function poll(job: Job, onSuccess: (result: TaskResult) => Promise<string>): Promise<void> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (job.status !== 'running') return; // aborted externally (see abortJob)
    let querying = true;
    try {
      const [row] = await queryResult([job.taskId]);
      querying = false;
      strikes = 0;
      if (!row) continue;
      if (row.status === 0) {
        job.progress = row.result?.[0]?.progress;
        job.progressStage = row.result?.[0]?.stage;
        job.progressText = row.progress_text;
        continue;
      }
      if (row.status === 2) {
        job.status = 'failed';
        job.error = 'generation failed';
        return;
      }
      const result = row.result.find((r) => r.status === 1) ?? row.result[0];
      if (!result?.file) {
        job.status = 'failed';
        job.error = 'no audio in result';
        return;
      }
      job.songId = await onSuccess(result);
      job.status = 'done';
      return;
    } catch (err) {
      // Only status-poll failures earn strikes; a failed onSuccess (download/persist) is final.
      if (querying && ++strikes < MAX_POLL_STRIKES) continue;
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      return;
    }
  }
}
