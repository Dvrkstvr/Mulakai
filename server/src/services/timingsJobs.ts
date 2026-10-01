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
import { type Job, registerJob, run, wasAborted } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { transcribeLyrics } from './lyricsClient.js';

export const TIMINGS_NOT_SET_UP = 'word timings are not set up: LYRICS_API_URL is unset';

/** Throws 'unknown version', TIMINGS_NOT_SET_UP, or GenLockError, all before any work starts. */
export function startVersionTimings(versionId: string): Job {
  const row = db
    .prepare(
      `SELECT v.audio_file, s.id AS song_id, s.title FROM versions v
       JOIN layers l ON l.id = v.layer_id JOIN songs s ON s.id = l.song_id WHERE v.id = ?`,
    )
    .get(versionId) as { audio_file: string; song_id: string; title: string } | undefined;
  if (!row) throw new Error('unknown version');
  if (!config.lyricsUrl) throw new Error(TIMINGS_NOT_SET_UP);

  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'running', createdAt: Date.now() };
  acquireGenLock({ kind: 'timings', jobId: job.id, songId: row.song_id, title: row.title });
  registerJob(job);
  // abortJob only marks the job failed; this turns that into cancelling the request.
  const abort = new AbortController();
  const watch = setInterval(() => wasAborted(job) && abort.abort(), config.pollIntervalMs);
  void run(job, async () => {
    const audio = await fs.readFile(path.join(config.audioDir, row.audio_file));
    const reading = await transcribeLyrics(audio, row.audio_file, '', abort.signal);
    if (wasAborted(job)) return;
    db.prepare(`UPDATE versions SET word_timings = ? WHERE id = ?`).run(JSON.stringify(reading), versionId);
    job.status = 'done';
  }).finally(() => {
    clearInterval(watch);
    // run() overwrote an abort's message with the cancelled request's error.
    if (abort.signal.aborted) job.error = 'Aborted';
    releaseGenLock(job.id);
  });
  return job;
}
