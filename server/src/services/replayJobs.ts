/** Replay a past version as a new, non-activated take: an independent alternate or a seed-anchored similar take. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, queueJob, poll, ensureModelLoaded, wasAborted, drainTask } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { activeLayerSource, assertVersionLive, layerName } from './queueGuards.js';
import { assertReplayable } from './replayGuard.js';
import { repaintLabel, persistVersion } from './repaintVersion.js';

interface StoredVersion { layer_id: string; params_json: string; label: string; seed: string }

/** The shared shape of ALT and SIMILAR: validate now, then queue a replay of `version` whose
 * source, for a repaint entry, is the layer's active audio when the job starts. The result is
 * appended to history, not activated. */
function queueReplay(
  kind: 'regenerate' | 'retake', version: StoredVersion & { id: string }, freshParams: ReleaseTaskParams, prefix: 'alt' | 'similar',
): Job {
  const taskType = freshParams.task_type ?? 'text2music';
  const { song_id: songId } = db.prepare(`SELECT song_id FROM layers WHERE id = ?`).get(version.layer_id) as { song_id: string };
  const label = taskType === 'repaint' ? repaintLabel(prefix, freshParams) : `${prefix}: ${version.label || 'generation'}`;
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', songId, createdAt: Date.now() };
  return queueJob({ kind, songId, layer: layerName(version.layer_id), label }, job, async () => {
    assertVersionLive(version.id);
    let srcAudio: { data: Buffer; filename: string } | undefined;
    if (taskType === 'repaint') {
      const active = activeLayerSource(version.layer_id);
      srcAudio = { data: await fs.readFile(path.join(config.audioDir, active.audio_file)), filename: active.audio_file };
    }
    // Force batch_size 1 (see addLayerJobs.ts) — poll() only ever keeps one result,
    // and only the PROMPT tab's TAKES slider should decide batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...freshParams, task_type: taskType, batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return; // aborted while the model was loading
    const { task_id } = await releaseTask(fullParams, srcAudio ? { srcAudio } : undefined);
    if (wasAborted(job)) return drainTask(task_id); // aborted while ACE-Step was accepting it

    job.taskId = task_id;
    job.status = 'running';
    await poll(job, (result) => persistVersion(version.layer_id, result.file, fullParams, result, label, false));
  });
}

function readVersion(versionId: string): StoredVersion & { id: string; stored: ReleaseTaskParams } {
  const version = db
    .prepare(`SELECT layer_id, params_json, label, seed FROM versions WHERE id = ?`)
    .get(versionId) as StoredVersion | undefined;
  if (!version) throw new Error('unknown version');
  const stored = JSON.parse(version.params_json) as ReleaseTaskParams;
  assertReplayable(stored);
  return { ...version, id: versionId, stored };
}

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
  const version = readVersion(versionId);
  const { seed: _seed, ...rest } = version.stored;
  return queueReplay('regenerate', version, { ...rest, task_type: rest.task_type ?? 'text2music', use_random_seed: true }, 'alt');
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
  const version = readVersion(versionId);
  const { seed: _seed, ...rest } = version.stored;
  return queueReplay('retake', version, {
    ...rest,
    task_type: rest.task_type ?? 'text2music',
    use_random_seed: true,
    retake_seed: version.seed,
    retake_variance: DEFAULT_RETAKE_VARIANCE,
  }, 'similar');
}
