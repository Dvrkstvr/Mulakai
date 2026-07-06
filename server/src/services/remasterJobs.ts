/**
 * Remaster orchestration: a one-shot ACE-Step `cover` pass over the song's
 * current audible mix, aimed at the highest quality single-file result
 * ACE-Step can produce. Unlike every other job type here, this one never
 * writes a DB row — the result goes to a scratch file and is streamed to
 * the client exactly once (see routes/remaster.ts), then deleted.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db/index.js';
import { releaseTask, downloadAudio, type ReleaseTaskParams } from './acestep.js';
import { type Job, registerJob, poll, ensureModelLoaded } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { tagOutputFile } from './fileTags.js';

/** Default steps if the caller doesn't pass one — matches modelInfo.ts's prior fixed value. */
const DEFAULT_REMASTER_STEPS = 100;
/** ACE-Step's documented Base-model ceiling (docs/ace-step-1.5/API.md#4.2) — not the requested 256. */
const MAX_REMASTER_STEPS = 200;

interface SongMeta {
  title: string;
  caption: string;
  lyrics: string;
  bpm: number | null;
  key_scale: string;
  time_signature: string;
  comment: string;
  genre: string;
  album: string;
  cover_art_file: string | null;
}

export interface RemasterOptions {
  audioFormat?: string;
  steps?: number;
}

/**
 * Cover the client-bounced current mix at max quality. `audio_cover_strength`
 * and `guidance_scale` are deliberately left unset so ACE-Step's own defaults
 * apply (1.0 = closest to source; server-default CFG) — see PLAN.md's Export
 * & Remaster design for why those aren't overridden here. `audioFormat`/`steps`
 * come from the client's Settings > Playback & Export defaults.
 */
export async function startRemaster(songId: string, mixAudio: Buffer, model: string, opts: RemasterOptions = {}): Promise<Job> {
  const song = db
    .prepare(`SELECT title, caption, lyrics, bpm, key_scale, time_signature, comment, genre, album, cover_art_file FROM songs WHERE id = ?`)
    .get(songId) as SongMeta | undefined;
  if (!song) throw new Error('unknown song');

  const audioFormat = opts.audioFormat ?? 'wav';
  const steps = Math.min(opts.steps ?? DEFAULT_REMASTER_STEPS, MAX_REMASTER_STEPS);

  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'remaster', jobId, songId });
  try {
    const fullParams: ReleaseTaskParams = {
      audio_format: audioFormat,
      task_type: 'cover',
      model,
      inference_steps: steps,
      prompt: song.caption,
      lyrics: song.lyrics,
      ...(song.bpm ? { bpm: song.bpm } : {}),
      ...(song.key_scale ? { key_scale: song.key_scale } : {}),
      ...(song.time_signature ? { time_signature: song.time_signature } : {}),
    };
    await ensureModelLoaded(fullParams);
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: mixAudio, filename: 'mix.wav' } });

    const job: Job = { id: jobId, taskId: task_id, status: 'running', songId, createdAt: Date.now() };
    registerJob(job);
    void poll(job, async (result) => {
      job.resultPath = await downloadToScratch(result.file, audioFormat);
      await tagOutputFile(job.resultPath, {
        title: song.title, bpm: song.bpm, keyScale: song.key_scale, comment: song.comment,
        genre: song.genre, album: song.album, coverArtFile: song.cover_art_file,
      });
      return songId;
    }).finally(() => releaseGenLock(jobId));
    return job;
  } catch (err) {
    releaseGenLock(jobId);
    throw err;
  }
}

/** Download the cover result to the OS temp dir, not `config.audioDir` — this file is never part of the library. */
async function downloadToScratch(fileUrl: string, audioFormat: string): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const ext = audioFormat === 'wav32' ? 'wav' : audioFormat;
  const filePath = path.join(os.tmpdir(), `mulakai-remaster-${crypto.randomUUID()}.${ext}`);
  await fs.writeFile(filePath, audio);
  return filePath;
}
