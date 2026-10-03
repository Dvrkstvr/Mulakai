import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LyricsReading } from './lyricsClient.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-timings-test-'));
process.env.POLL_INTERVAL_MS = '5';
process.env.LYRICS_API_URL = 'http://127.0.0.1:8005';

const READING: LyricsReading = {
  language: 'en',
  segments: [{ text: 'Midnight city', start: 20.98, end: 22.06, words: [{ text: 'Midnight', start: 20.98, end: 21.62 }] }],
};
const transcribeLyrics = vi.fn(async (..._a: unknown[]): Promise<LyricsReading> => READING);
vi.mock('./lyricsClient.js', () => ({ transcribeLyrics: (...a: unknown[]) => transcribeLyrics(...a) }));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { getJob, abortJob } = await import('./jobs.js');
const { enqueue, getRunning } = await import('./genQueue.js');
const { startVersionTimings, TIMINGS_NOT_SET_UP } = await import('./timingsJobs.js');
const { VERSION_DELETED } = await import('./queueGuards.js');

/** A song with one base version whose audio file really exists in audioDir. */
function seedVersion(): { songId: string; versionId: string; audioFile: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const audioFile = `${versionId}.wav`;
  fs.writeFileSync(path.join(config.audioDir, audioFile), 'audio bytes');
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Ellies City')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json) VALUES (?, ?, ?, '{}')`).run(versionId, layerId, audioFile);
  return { songId, versionId, audioFile };
}

const storedTimings = (versionId: string) =>
  (db.prepare(`SELECT word_timings FROM versions WHERE id = ?`).get(versionId) as { word_timings: string | null }).word_timings;

async function settle(jobId: string, status: 'done' | 'failed') {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status));
  await vi.waitFor(() => expect(getRunning()).toBeNull());
}

beforeEach(() => {
  config.lyricsUrl = 'http://127.0.0.1:8005';
  transcribeLyrics.mockReset();
  transcribeLyrics.mockImplementation(async () => READING);
});

describe('startVersionTimings', () => {
  it("holds the lock as timings, sends the version's audio auto-detected and saves the reading", async () => {
    const { songId, versionId, audioFile } = seedVersion();
    const job = startVersionTimings(versionId);
    expect(getRunning()).toMatchObject({ kind: 'timings', jobId: job.id, songId, title: 'Ellies City' });
    await settle(job.id, 'done');

    const [data, filename, language, signal] = transcribeLyrics.mock.calls[0];
    expect([String(data), filename, language]).toEqual(['audio bytes', audioFile, '']);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(storedTimings(versionId) ?? 'null')).toEqual(READING);
    expect(getJob(job.id)?.songId).toBeUndefined(); // no new song for the library to pick up
  });

  it("fails with the service's message, saves nothing and frees the lock", async () => {
    const { versionId } = seedVersion();
    transcribeLyrics.mockRejectedValueOnce(new Error('lyrics-server transcribe -> CUDA out of memory'));
    const job = startVersionTimings(versionId);
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('lyrics-server transcribe -> CUDA out of memory');
    expect(storedTimings(versionId)).toBeNull();
  });

  it('fails when the audio file is gone', async () => {
    const { versionId, audioFile } = seedVersion();
    fs.rmSync(path.join(config.audioDir, audioFile));
    const job = startVersionTimings(versionId);
    await settle(job.id, 'failed');
    expect(transcribeLyrics).not.toHaveBeenCalled();
  });

  it('cancels the request when aborted, saves nothing and keeps the abort as the reason', async () => {
    const { versionId } = seedVersion();
    transcribeLyrics.mockImplementationOnce((...a: unknown[]) => new Promise((_resolve, reject) => {
      (a[3] as AbortSignal).addEventListener('abort', () => reject(new Error('lyrics-server transcribe -> This operation was aborted')));
    }));
    const job = startVersionTimings(versionId);
    await vi.waitFor(() => expect(transcribeLyrics).toHaveBeenCalled());
    expect(abortJob(job.id)).toBe(true);
    expect(getRunning()).toBeNull();

    await vi.waitFor(() => expect(getJob(job.id)?.error).toBe('Aborted'));
    expect(getJob(job.id)?.status).toBe('failed');
    expect(storedTimings(versionId)).toBeNull();
  });

  it('refuses an unknown version and an unset service before queueing anything', () => {
    expect(() => startVersionTimings('nope')).toThrow('unknown version');
    const { versionId } = seedVersion();
    config.lyricsUrl = '';
    expect(() => startVersionTimings(versionId)).toThrow(TIMINGS_NOT_SET_UP);
    expect(getRunning()).toBeNull();
    config.lyricsUrl = 'http://127.0.0.1:8005';
    expect(transcribeLyrics).not.toHaveBeenCalled();
  });

  it('reuses a read already queued for the same version instead of queueing a second', async () => {
    const { versionId } = seedVersion();
    let free!: () => void;
    enqueue({ kind: 'generate', jobId: 'other' }, () => new Promise<void>((r) => { free = r; }));
    const first = startVersionTimings(versionId);
    const again = startVersionTimings(versionId);
    expect(again.id).toBe(first.id);
    expect(first.status).toBe('queued');
    free();
    await vi.waitFor(() => expect(getJob(first.id)?.status).toBe('done'));
    expect(transcribeLyrics).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    // settled: a later request reads again
    expect(startVersionTimings(versionId).id).not.toBe(first.id);
    await vi.waitFor(() => expect(getRunning()).toBeNull());
  });

  it('fails a queued read whose version was deleted before its turn', async () => {
    const { versionId } = seedVersion();
    let free!: () => void;
    enqueue({ kind: 'generate', jobId: 'other' }, () => new Promise<void>((r) => { free = r; }));
    const job = startVersionTimings(versionId);
    db.prepare(`DELETE FROM versions WHERE id = ?`).run(versionId);
    free();
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('failed'));
    expect(getJob(job.id)?.error).toBe(VERSION_DELETED);
    expect(transcribeLyrics).not.toHaveBeenCalled();
  });
});
