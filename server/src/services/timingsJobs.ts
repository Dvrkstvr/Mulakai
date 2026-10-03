/**
 * Editor word timings (PLAN.md "Editor Word Timestamps: Click a Lyric Line"): one version's
 * audio, as-is, to lyrics-server, and the reading saved on that version. The client aligns
 * it to the song's LYRICS; the heard words are only used for their times. Language is always
 * auto-detected (decision 7): a wrong forced language makes Whisper translate.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { type Job, queueJob, wasAborted } from './jobs.js';
import { abortable } from './lyricsJobs.js';
import { assertVersionLive } from './queueGuards.js';
import { transcribeLyrics } from './lyricsClient.js';

export const TIMINGS_NOT_SET_UP = 'word timings are not set up: LYRICS_API_URL is unset';

/** Unsettled reads by version: a second request for the same version gets the job already
 * queued or running instead of a second place in line. */
const pending = new Map<string, Job>();

/** Throws 'unknown version', TIMINGS_NOT_SET_UP, or QueueFullError, all before any work starts. */
export function startVersionTimings(versionId: string): Job {
  const row = db
    .prepare(
      `SELECT s.id AS song_id, s.title FROM versions v
       JOIN layers l ON l.id = v.layer_id JOIN songs s ON s.id = l.song_id WHERE v.id = ?`,
    )
    .get(versionId) as { song_id: string; title: string } | undefined;
  if (!row) throw new Error('unknown version');
  if (!config.lyricsUrl) throw new Error(TIMINGS_NOT_SET_UP);
  const existing = pending.get(versionId);
  if (existing && (existing.status === 'queued' || existing.status === 'running')) return existing;

  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  queueJob({ kind: 'timings', songId: row.song_id, title: row.title, label: 'word timings' }, job, () => abortable(job, async () => {
    assertVersionLive(versionId);
    const { audio_file } = db.prepare(`SELECT audio_file FROM versions WHERE id = ?`).get(versionId) as { audio_file: string };
    const audio = await fs.readFile(path.join(config.audioDir, audio_file));
    const reading = await transcribeLyrics(audio, audio_file, '');
    if (wasAborted(job)) return;
    db.prepare(`UPDATE versions SET word_timings = ? WHERE id = ?`).run(JSON.stringify(reading), versionId);
    job.status = 'done';
  }).finally(() => {
    if (pending.get(versionId) === job) pending.delete(versionId);
  }), 'running');
  pending.set(versionId, job);
  return job;
}
