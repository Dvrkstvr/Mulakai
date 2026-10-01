/** Layer/version mutation orchestration: repaint an existing layer, or regenerate a past version as an alternate. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, registerJob, poll, ensureModelLoaded, wasAborted } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { repaintLabel, persistVersion } from './repaintVersion.js';

export { startRegenerate, startSimilarTake } from './replayJobs.js';

/** Repaint a region of a layer's active version; result becomes the layer's new active version. */
export async function startRepaint(layerId: string, params: ReleaseTaskParams): Promise<Job> {
  const row = db
    .prepare(
      `SELECT v.audio_file, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE l.id = ? AND v.active = 1`,
    )
    .get(layerId) as { audio_file: string; song_id: string } | undefined;
  if (!row) throw new Error('unknown layer');

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'repaint', jobId, songId: row.song_id });
  // Registered before any await so a header ABORT fired during model-load/submission has
  // something to mark (see jobs.ts's abortJob) instead of silently no-oping — the old
  // register-after-submit shape left that whole window unabortable.
  const job: Job = { id: jobId, taskId: '', status: 'loading', songId: row.song_id, createdAt: Date.now() };
  registerJob(job);
  try {
    const srcAudio = await fs.readFile(path.join(config.audioDir, row.audio_file));
    // Force batch_size 1 (see addLayerJobs.ts) — poll() only ever keeps one result,
    // and only the PROMPT tab's TAKES slider should decide batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'repaint', batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return job; // aborted while the model was loading
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: srcAudio, filename: row.audio_file } });
    if (wasAborted(job)) return job; // aborted while ACE-Step was accepting the submission

    job.taskId = task_id;
    job.status = 'running';
    void poll(job, (result) => persistVersion(layerId, result.file, fullParams, result, repaintLabel('repaint', params)))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    releaseGenLock(jobId);
    throw err;
  }
}
