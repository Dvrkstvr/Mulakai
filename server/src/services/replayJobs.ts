/** Replay a past version as a new, non-activated take: an independent alternate or a seed-anchored similar take. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, registerJob, poll, ensureModelLoaded, wasAborted } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { assertReplayable } from './replayGuard.js';
import { repaintLabel, persistVersion } from './repaintVersion.js';

/**
 * Regenerate a past version as an alternate take: replays its stored prompt/
 * region/model with a fresh random seed (an "alternate" implies variation,
 * not exact reproduction). Repaint entries source audio from the layer's
 * *current* active version, not a reconstructed historical state — simplest
 * option, consistent with how repaint already works. text2music entries (the
 * base layer's first generation) replay with no source audio. Result is
 * appended to history but does not become active (see PLAN.md).
 */
export async function startRegenerate(versionId: string): Promise<Job> {
  const version = db
    .prepare(`SELECT layer_id, params_json, label FROM versions WHERE id = ?`)
    .get(versionId) as { layer_id: string; params_json: string; label: string } | undefined;
  if (!version) throw new Error('unknown version');

  const stored = JSON.parse(version.params_json) as ReleaseTaskParams;
  assertReplayable(stored);
  const taskType = stored.task_type ?? 'text2music';
  const { seed: _seed, ...rest } = stored;
  const freshParams: ReleaseTaskParams = { ...rest, use_random_seed: true };

  const layerRow = db.prepare(`SELECT song_id FROM layers WHERE id = ?`).get(version.layer_id) as { song_id: string };

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'regenerate', jobId, songId: layerRow.song_id });
  const job: Job = { id: jobId, taskId: '', status: 'loading', songId: layerRow.song_id, createdAt: Date.now() };
  registerJob(job);
  try {
    let srcAudio: { data: Buffer; filename: string } | undefined;
    if (taskType === 'repaint') {
      const active = db
        .prepare(`SELECT audio_file FROM versions WHERE layer_id = ? AND active = 1`)
        .get(version.layer_id) as { audio_file: string } | undefined;
      if (!active) throw new Error('unknown version');
      srcAudio = { data: await fs.readFile(path.join(config.audioDir, active.audio_file)), filename: active.audio_file };
    }

    // Force batch_size 1 (see addLayerJobs.ts) — poll() only ever keeps one result,
    // and only the PROMPT tab's TAKES slider should decide batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...freshParams, task_type: taskType, batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return job; // aborted while the model was loading
    const { task_id } = await releaseTask(fullParams, srcAudio ? { srcAudio } : undefined);
    if (wasAborted(job)) return job; // aborted while ACE-Step was accepting the submission

    job.taskId = task_id;
    job.status = 'running';
    const label = taskType === 'repaint' ? repaintLabel('alt', freshParams) : `alt: ${version.label || 'generation'}`;
    void poll(job, (result) => persistVersion(version.layer_id, result.file, fullParams, result, label, false))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    releaseGenLock(jobId);
    throw err;
  }
}

/**
 * "Similar take" variance: subtle by default, per ACE-Step's own slider guidance
 * (0=baseline; 0.05-0.15 subtle; 0.5+ strong) — a fixed default for v1, no UI control yet.
 */
const DEFAULT_RETAKE_VARIANCE = 0.1;

/**
 * Generate a variance-preserving variation of a past version: anchors on its stored
 * seed via retake_seed/retake_variance instead of an independent random regenerate.
 * Same source-audio and label conventions as startRegenerate; appended to history,
 * not activated.
 */
export async function startSimilarTake(versionId: string): Promise<Job> {
  const version = db
    .prepare(`SELECT layer_id, params_json, label, seed FROM versions WHERE id = ?`)
    .get(versionId) as { layer_id: string; params_json: string; label: string; seed: string } | undefined;
  if (!version) throw new Error('unknown version');

  const stored = JSON.parse(version.params_json) as ReleaseTaskParams;
  assertReplayable(stored);
  const taskType = stored.task_type ?? 'text2music';
  const { seed: _seed, ...rest } = stored;
  const freshParams: ReleaseTaskParams = {
    ...rest,
    use_random_seed: true,
    retake_seed: version.seed,
    retake_variance: DEFAULT_RETAKE_VARIANCE,
  };

  const layerRow = db.prepare(`SELECT song_id FROM layers WHERE id = ?`).get(version.layer_id) as { song_id: string };

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'retake', jobId, songId: layerRow.song_id });
  const job: Job = { id: jobId, taskId: '', status: 'loading', songId: layerRow.song_id, createdAt: Date.now() };
  registerJob(job);
  try {
    let srcAudio: { data: Buffer; filename: string } | undefined;
    if (taskType === 'repaint') {
      const active = db
        .prepare(`SELECT audio_file FROM versions WHERE layer_id = ? AND active = 1`)
        .get(version.layer_id) as { audio_file: string } | undefined;
      if (!active) throw new Error('unknown version');
      srcAudio = { data: await fs.readFile(path.join(config.audioDir, active.audio_file)), filename: active.audio_file };
    }

    // Force batch_size 1 (see addLayerJobs.ts) — poll() only ever keeps one result,
    // and only the PROMPT tab's TAKES slider should decide batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...freshParams, task_type: taskType, batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return job; // aborted while the model was loading
    const { task_id } = await releaseTask(fullParams, srcAudio ? { srcAudio } : undefined);
    if (wasAborted(job)) return job; // aborted while ACE-Step was accepting the submission

    job.taskId = task_id;
    job.status = 'running';
    const label = taskType === 'repaint' ? repaintLabel('similar', freshParams) : `similar: ${version.label || 'generation'}`;
    void poll(job, (result) => persistVersion(version.layer_id, result.file, fullParams, result, label, false))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    releaseGenLock(jobId);
    throw err;
  }
}
