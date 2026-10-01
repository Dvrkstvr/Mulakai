/**
 * READ LYRICS (PLAN.md "Cover Lyrics From the Recording" and its PR 2 block): the source,
 * as-is, to lyrics-server, which reads the sung words into timed segments. No vocal split:
 * the mix read better than the separated vocals in the spike. Nothing is written to the
 * library; the reading stays on the job for the client to place into LYRICS.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, registerJob, run, wasAborted } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';
import { transcribeLyrics, type LyricsReading } from './lyricsClient.js';

export interface LyricsOutcome extends LyricsReading {
  sourceLabel: string;
}

export interface LyricsSource {
  data: Buffer;
  filename: string;
  label: string;
  /** Empty = auto-detect. */
  language: string;
}

/** Throws GenLockError synchronously if another generation holds the lock. */
export function startLyricsTranscription(source: LyricsSource): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'running', createdAt: Date.now() };
  acquireGenLock({ kind: 'lyrics', jobId: job.id, title: source.label });
  registerJob(job);
  // abortJob only marks the job failed; this turns that into cancelling the request.
  const abort = new AbortController();
  const watch = setInterval(() => wasAborted(job) && abort.abort(), config.pollIntervalMs);
  void run(job, async () => {
    const reading = await transcribeLyrics(source.data, source.filename, source.language, abort.signal);
    if (wasAborted(job)) return;
    job.lyrics = { ...reading, sourceLabel: source.label };
    job.status = 'done';
  }).finally(() => {
    clearInterval(watch);
    // run() overwrote an abort's message with the cancelled request's error.
    if (abort.signal.aborted) job.error = 'Aborted';
    releaseGenLock(job.id);
  });
  return job;
}
