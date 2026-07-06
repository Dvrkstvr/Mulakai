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

/** modelInfo.ts's documented ceiling for non-Turbo models (Turbo doesn't meaningfully support `cover` and is excluded by the model gate anyway). */
const REMASTER_STEPS = 100;

interface SongMeta {
  caption: string;
  lyrics: string;
  bpm: number | null;
  key_scale: string;
  time_signature: string;
}

/**
 * Cover the client-bounced current mix at max quality. `audio_cover_strength`
 * and `guidance_scale` are deliberately left unset so ACE-Step's own defaults
 * apply (1.0 = closest to source; server-default CFG) — see PLAN.md's Export
 * & Remaster design for why those aren't overridden here.
 */
export async function startRemaster(songId: string, mixAudio: Buffer, model: string): Promise<Job> {
  const song = db
    .prepare(`SELECT caption, lyrics, bpm, key_scale, time_signature FROM songs WHERE id = ?`)
    .get(songId) as SongMeta | undefined;
  if (!song) throw new Error('unknown song');

  const fullParams: ReleaseTaskParams = {
    audio_format: 'wav',
    task_type: 'cover',
    model,
    inference_steps: REMASTER_STEPS,
    prompt: song.caption,
    lyrics: song.lyrics,
    ...(song.bpm ? { bpm: song.bpm } : {}),
    ...(song.key_scale ? { key_scale: song.key_scale } : {}),
    ...(song.time_signature ? { time_signature: song.time_signature } : {}),
  };
  await ensureModelLoaded(fullParams);
  const { task_id } = await releaseTask(fullParams, { srcAudio: { data: mixAudio, filename: 'mix.wav' } });

  const job: Job = { id: crypto.randomUUID(), taskId: task_id, status: 'running', songId, createdAt: Date.now() };
  registerJob(job);
  void poll(job, async (result) => {
    job.resultPath = await downloadToScratch(result.file);
    return songId;
  });
  return job;
}

/** Download the cover result to the OS temp dir, not `config.audioDir` — this file is never part of the library. */
async function downloadToScratch(fileUrl: string): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const filePath = path.join(os.tmpdir(), `mulakai-remaster-${crypto.randomUUID()}.wav`);
  await fs.writeFile(filePath, audio);
  return filePath;
}
