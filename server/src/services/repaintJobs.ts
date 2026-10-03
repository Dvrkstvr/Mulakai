/** Layer/version mutation orchestration: repaint an existing layer, or regenerate a past version as an alternate. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, queueJob, poll, ensureModelLoaded, wasAborted } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { activeLayerSource, layerName } from './queueGuards.js';
import { repaintLabel, persistVersion } from './repaintVersion.js';

export { startRegenerate, startSimilarTake } from './replayJobs.js';

/** Queue a repaint of a region of a layer's active version; the result becomes the layer's
 * new active version. The source is read when the job starts, so a repaint queued behind
 * another on the same layer works on that one's result. */
export async function startRepaint(layerId: string, params: ReleaseTaskParams): Promise<Job> {
  const { song_id: songId } = activeLayerSource(layerId, 'unknown layer');
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', songId, createdAt: Date.now() };
  return queueJob({ kind: 'repaint', songId, layer: layerName(layerId), label: repaintLabel('repaint', params) }, job, async () => {
    const row = activeLayerSource(layerId);
    const srcAudio = await fs.readFile(path.join(config.audioDir, row.audio_file));
    // Force batch_size 1 (see addLayerJobs.ts) — poll() only ever keeps one result,
    // and only the PROMPT tab's TAKES slider should decide batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'repaint', batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return; // aborted while the model was loading
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: srcAudio, filename: row.audio_file } });
    if (wasAborted(job)) return; // aborted while ACE-Step was accepting the submission

    job.taskId = task_id;
    job.status = 'running';
    await poll(job, (result) => persistVersion(layerId, result.file, fullParams, result, repaintLabel('repaint', params)));
  });
}
