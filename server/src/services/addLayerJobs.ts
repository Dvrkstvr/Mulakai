/** Add Layer (`lego`) orchestration: generate a new layer conditioned on the client-bounced mix of currently audible layers. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { releaseTask, downloadAudio, audioFileExt, type ReleaseTaskParams, type TaskResult } from './acestep.js';
import { type Job, type VoiceOptions, registerJob, poll, ensureModelLoaded } from './jobs.js';
import { loadVoiceReference, applyVoiceInfluence } from './voiceConditioning.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { tagOutputFile } from './fileTags.js';

/**
 * Add a new layer to a song via `lego`, conditioned on a pre-mixed bounce of
 * the currently audible layers, provided by the client (see
 * client/src/mix/bounceMix.ts) — the server no longer reads any layer's
 * audio off disk for this, since with multiple layers the "current mix" is
 * a client-side render, not any single layer's file.
 */
export async function startAddLayer(
  songId: string,
  prompt: string,
  layerName: string,
  mixAudio: Buffer,
  params: ReleaseTaskParams,
  voice?: VoiceOptions,
): Promise<Job> {
  const song = db.prepare(`SELECT id FROM songs WHERE id = ?`).get(songId) as { id: string } | undefined;
  if (!song) throw new Error('unknown song');

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'addLayer', jobId, songId });
  try {
    const fullParams: ReleaseTaskParams = {
      audio_format: 'wav',
      ...params,
      task_type: 'lego',
      prompt,
      repainting_start: 0,
      repainting_end: -1,
    };
    const ref = voice?.voiceId
      ? await loadVoiceReference(voice.voiceId, { audioInfluence: voice.audioInfluence, styleInfluence: voice.styleInfluence })
      : undefined;
    if (ref) applyVoiceInfluence(fullParams, ref);
    await ensureModelLoaded(fullParams);
    const { task_id } = await releaseTask(fullParams, {
      srcAudio: { data: mixAudio, filename: 'mix.wav' },
      ...(ref ? { referenceAudio: ref.referenceAudio } : {}),
    });

    const job: Job = {
      id: jobId, taskId: task_id, status: 'running',
      songId, createdAt: Date.now(),
    };
    registerJob(job);
    void poll(job, (result) => persistNewLayer(songId, layerName, result.file, fullParams, result))
      .finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    releaseGenLock(jobId);
    throw err;
  }
}

/** Store a lego result as a brand new layer + its first (active) version. */
async function persistNewLayer(
  songId: string,
  layerName: string,
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.${audioFileExt(params.audio_format)}`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  const song = db.prepare(`SELECT title, bpm, key_scale FROM songs WHERE id = ?`).get(songId) as
    { title: string; bpm: number | null; key_scale: string } | undefined;
  if (song) await tagOutputFile(path.join(config.audioDir, filename), { title: song.title, bpm: song.bpm, keyScale: song.key_scale });

  const { maxPos } = db
    .prepare(`SELECT COALESCE(MAX(position), -1) as maxPos FROM layers WHERE song_id = ?`)
    .get(songId) as { maxPos: number };

  db.prepare(
    `INSERT INTO layers (id, song_id, name, kind, position, region_start, region_end)
     VALUES (?, ?, ?, 'instrument', ?, 0, NULL)`,
  ).run(layerId, songId, layerName, maxPos + 1);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active)
     VALUES (?, ?, ?, 'add layer', ?, ?, 1)`,
  ).run(versionId, layerId, filename, JSON.stringify(params), result.seed_value);

  return songId;
}
