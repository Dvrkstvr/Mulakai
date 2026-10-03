/**
 * READ LYRICS (PLAN.md "Cover Lyrics From the Recording" and its PR 2 block): the source,
 * as-is, to lyrics-server, which reads the sung words into timed segments. No vocal split:
 * the mix read better than the separated vocals in the spike. Nothing is written to the
 * library; the reading stays on the job for the client to place into LYRICS.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { type Job, queueJob, wasAborted } from './jobs.js';
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

/** Throws QueueFullError synchronously when the queue is full. */
export function startLyricsTranscription(source: LyricsSource): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'lyrics', title: source.label }, job, () => abortable(job, async (signal) => {
    const reading = await transcribeLyrics(source.data, source.filename, source.language, signal);
    if (wasAborted(job)) return;
    job.lyrics = { ...reading, sourceLabel: source.label };
    job.status = 'done';
  }), 'running');
}

/** abortJob only marks the job failed; this turns that into cancelling the request, and keeps
 * the abort's own message rather than the cancelled request's error. */
export async function abortable(job: Job, body: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const abort = new AbortController();
  const watch = setInterval(() => wasAborted(job) && abort.abort(), config.pollIntervalMs);
  try {
    await body(abort.signal);
  } catch (err) {
    if (!abort.signal.aborted) throw err;
  } finally {
    clearInterval(watch);
  }
}
