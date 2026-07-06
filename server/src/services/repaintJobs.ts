/** Layer/version mutation orchestration: repaint an existing layer, or regenerate a past version as an alternate. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, downloadAudio, audioFileExt, type ReleaseTaskParams, type TaskResult } from './acestep.js';
import { type Job, registerJob, poll, ensureModelLoaded, fetchLyricTimestampsJson } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function repaintLabel(prefix: string, params: ReleaseTaskParams): string {
  return `${prefix} ${fmtTime(params.repainting_start ?? 0)}–${
    params.repainting_end && params.repainting_end > 0 ? fmtTime(params.repainting_end) : 'end'}`;
}

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
  try {
    const srcAudio = await fs.readFile(path.join(config.audioDir, row.audio_file));
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'repaint' };
    await ensureModelLoaded(fullParams);
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: srcAudio, filename: row.audio_file } });

    const job: Job = {
      id: jobId, taskId: task_id, status: 'running',
      songId: row.song_id, createdAt: Date.now(),
    };
    registerJob(job);
    void poll(job, (result) => persistVersion(layerId, result.file, fullParams, result, repaintLabel('repaint', params)))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    releaseGenLock(jobId);
    throw err;
  }
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
  const version = db
    .prepare(`SELECT layer_id, params_json, label FROM versions WHERE id = ?`)
    .get(versionId) as { layer_id: string; params_json: string; label: string } | undefined;
  if (!version) throw new Error('unknown version');

  const stored = JSON.parse(version.params_json) as ReleaseTaskParams;
  const taskType = stored.task_type ?? 'text2music';
  const { seed: _seed, ...rest } = stored;
  const freshParams: ReleaseTaskParams = { ...rest, use_random_seed: true };

  const layerRow = db.prepare(`SELECT song_id FROM layers WHERE id = ?`).get(version.layer_id) as { song_id: string };

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'regenerate', jobId, songId: layerRow.song_id });
  try {
    let srcAudio: { data: Buffer; filename: string } | undefined;
    if (taskType === 'repaint') {
      const active = db
        .prepare(`SELECT audio_file FROM versions WHERE layer_id = ? AND active = 1`)
        .get(version.layer_id) as { audio_file: string } | undefined;
      if (!active) throw new Error('unknown version');
      srcAudio = { data: await fs.readFile(path.join(config.audioDir, active.audio_file)), filename: active.audio_file };
    }

    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...freshParams, task_type: taskType };
    await ensureModelLoaded(fullParams);
    const { task_id } = await releaseTask(fullParams, srcAudio ? { srcAudio } : undefined);

    const job: Job = {
      id: jobId, taskId: task_id, status: 'running',
      songId: layerRow.song_id, createdAt: Date.now(),
    };
    registerJob(job);
    const label = taskType === 'repaint' ? repaintLabel('alt', freshParams) : `alt: ${version.label || 'generation'}`;
    void poll(job, (result) => persistVersion(version.layer_id, result.file, fullParams, result, label, false))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
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
  try {
    let srcAudio: { data: Buffer; filename: string } | undefined;
    if (taskType === 'repaint') {
      const active = db
        .prepare(`SELECT audio_file FROM versions WHERE layer_id = ? AND active = 1`)
        .get(version.layer_id) as { audio_file: string } | undefined;
      if (!active) throw new Error('unknown version');
      srcAudio = { data: await fs.readFile(path.join(config.audioDir, active.audio_file)), filename: active.audio_file };
    }

    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...freshParams, task_type: taskType };
    await ensureModelLoaded(fullParams);
    const { task_id } = await releaseTask(fullParams, srcAudio ? { srcAudio } : undefined);

    const job: Job = {
      id: jobId, taskId: task_id, status: 'running',
      songId: layerRow.song_id, createdAt: Date.now(),
    };
    registerJob(job);
    const label = taskType === 'repaint' ? repaintLabel('similar', freshParams) : `similar: ${version.label || 'generation'}`;
    void poll(job, (result) => persistVersion(version.layer_id, result.file, fullParams, result, label, false))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    releaseGenLock(jobId);
    throw err;
  }
}

/** Store a repaint/regenerate result as a version. `activate` (default true) makes it the layer's current version. */
async function persistVersion(
  layerId: string,
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  label: string,
  activate = true,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.${audioFileExt(params.audio_format)}`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  if (activate) db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active, lyric_timestamps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(versionId, layerId, filename, label, JSON.stringify(params), result.seed_value, activate ? 1 : 0, lyricTimestamps);

  const row = db.prepare(`SELECT song_id, kind FROM layers WHERE id = ?`).get(layerId) as { song_id: string; kind: string };

  // A repaint that edited lyrics for the base layer becomes the song's canonical
  // lyrics going forward (search, section-strip alignment, future repaints) —
  // only when this version actually becomes active; regenerate/similar-take
  // append history without activating and shouldn't touch canonical lyrics.
  // Each version's own params_json still retains the lyrics it was rendered
  // with, so reverting to an older version (see versions.ts) restores it too.
  if (activate && row.kind === 'base' && typeof params.lyrics === 'string' && params.lyrics.trim()) {
    db.prepare(`UPDATE songs SET lyrics = ? WHERE id = ?`).run(params.lyrics, row.song_id);
  }

  return row.song_id;
}
