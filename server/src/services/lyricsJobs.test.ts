import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LyricsReading } from './lyricsClient.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-lyrics-test-'));
process.env.POLL_INTERVAL_MS = '5';

const READING: LyricsReading = {
  language: 'en',
  segments: [{ text: 'Midnight city', start: 10.26, end: 12.16, words: [{ text: 'Midnight', start: 10.26, end: 11.66 }] }],
};
const transcribeLyrics = vi.fn(async (..._a: unknown[]): Promise<LyricsReading> => READING);
vi.mock('./lyricsClient.js', () => ({ transcribeLyrics: (...a: unknown[]) => transcribeLyrics(...a) }));

const { getJob, abortJob } = await import('./jobs.js');
const { enqueue, getRunning } = await import('./genQueue.js');
const { startLyricsTranscription } = await import('./lyricsJobs.js');

const source = { data: Buffer.from('audio'), filename: 'ellies.wav', label: 'Ellies City 2', language: 'en' };

async function settle(jobId: string, status: 'done' | 'failed') {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status));
  await vi.waitFor(() => expect(getRunning()).toBeNull());
}

beforeEach(() => {
  transcribeLyrics.mockReset();
  transcribeLyrics.mockImplementation(async () => READING);
});

describe('startLyricsTranscription', () => {
  it('holds the lock as lyrics, sends the source as-is and keeps the reading on the job', async () => {
    const job = startLyricsTranscription(source);
    expect(getRunning()).toMatchObject({ kind: 'lyrics', jobId: job.id, title: 'Ellies City 2' });
    await settle(job.id, 'done');

    const [data, filename, language, signal] = transcribeLyrics.mock.calls[0];
    expect([data, filename, language]).toEqual([source.data, 'ellies.wav', 'en']);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(getJob(job.id)?.lyrics).toEqual({ ...READING, sourceLabel: 'Ellies City 2' });
    expect(getJob(job.id)?.songId).toBeUndefined(); // nothing reaches the library
  });

  it("fails the job with the service's message and frees the lock", async () => {
    transcribeLyrics.mockRejectedValueOnce(new Error('lyrics-server transcribe -> CUDA out of memory'));
    const job = startLyricsTranscription(source);
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('lyrics-server transcribe -> CUDA out of memory');
    expect(getJob(job.id)?.lyrics).toBeUndefined();
  });

  it('cancels the request when aborted and keeps the abort as the reason', async () => {
    transcribeLyrics.mockImplementationOnce((...a: unknown[]) => new Promise((_resolve, reject) => {
      (a[3] as AbortSignal).addEventListener('abort', () => reject(new Error('lyrics-server transcribe -> This operation was aborted')));
    }));
    const job = startLyricsTranscription(source);
    expect(abortJob(job.id)).toBe(true);
    expect(getRunning()).toBeNull();

    await vi.waitFor(() => expect((transcribeLyrics.mock.calls[0][3] as AbortSignal).aborted).toBe(true));
    await vi.waitFor(() => expect(getJob(job.id)?.error).toBe('Aborted'));
    expect(getJob(job.id)?.status).toBe('failed');
  });

  it('waits in the queue behind a running job, then reads once it finishes', async () => {
    let free!: () => void;
    enqueue({ kind: 'generate', jobId: 'other' }, () => new Promise<void>((r) => { free = r; }));
    const job = startLyricsTranscription(source);
    expect(job.status).toBe('queued');
    expect(transcribeLyrics).not.toHaveBeenCalled();
    free();
    await settle(job.id, 'done');
    expect(transcribeLyrics).toHaveBeenCalledTimes(1);
  });
});
