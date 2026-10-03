/**
 * READ LYRICS (PLAN.md "Cover Lyrics From the Recording" and its PR 2 block): the source,
 * as-is, to lyrics-server, which reads the sung words into timed segments. No vocal split:
 * the mix read better than the separated vocals in the spike. Nothing is written to the
 * library; the reading stays on the job for the client to place into LYRICS.
 */
import crypto from 'node:crypto';
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
  return queueJob({ kind: 'lyrics', title: source.label }, job, () => abortable(job, async () => {
    const reading = await transcribeLyrics(source.data, source.filename, source.language);
    if (wasAborted(job)) return;
    job.lyrics = { ...reading, sourceLabel: source.label };
    job.status = 'done';
  }), 'running');
}

/** An aborted read keeps the queue's slot until lyrics-server answers, or lyricsTimeoutMs fires:
 * it has no cancel, and dropping the request wouldn't stop its work on the GPU. The reading is
 * then ignored (the body checks wasAborted), and a late error keeps the abort's own message. */
export async function abortable(job: Job, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    if (!wasAborted(job)) throw err;
  }
}
