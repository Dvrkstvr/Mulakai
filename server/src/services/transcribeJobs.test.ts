import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SongEngine } from './engines/types.js';
import type { TranscriptionState } from './engineTranscribeClient.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-transcribe-test-'));
process.env.POLL_INTERVAL_MS = '5';

const FACTS = { warnings: ['short clip'], measures: 44, vocalNotes: 167, instrumentalNotes: 16, durationSeconds: 140, hasPreview: true };
const client = {
  transcribe: vi.fn(async (..._a: unknown[]) => 'remote-1'),
  transcriptionStatus: vi.fn(async (..._a: unknown[]): Promise<TranscriptionState> => ({ state: 'done', facts: FACTS })),
  fetchTranscriptionScore: vi.fn(async (..._a: unknown[]) => 'X:1\nK:Fm\n'),
  cancelTranscription: vi.fn(async (..._a: unknown[]) => {}),
};
vi.mock('./engineTranscribeClient.js', () => ({
  transcribe: (...a: unknown[]) => client.transcribe(...a),
  transcriptionStatus: (...a: unknown[]) => client.transcriptionStatus(...a),
  fetchTranscriptionScore: (...a: unknown[]) => client.fetchTranscriptionScore(...a),
  cancelTranscription: (...a: unknown[]) => client.cancelTranscription(...a),
}));

const { getJob, abortJob } = await import('./jobs.js');
const { acquireGenLock, releaseGenLock, getGenLock, GenLockError } = await import('./genLock.js');
const { startTranscription } = await import('./transcribeJobs.js');

const engine = { id: 'yue2', label: 'YUE2', url: 'http://127.0.0.1:9000', apiKey: '' } as SongEngine;
const source = { data: Buffer.from('audio'), filename: 'ellies.wav', label: 'Ellies City 2' };

async function settle(jobId: string, status: 'done' | 'failed') {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status));
  await vi.waitFor(() => expect(getGenLock()).toBeNull());
}

beforeEach(() => {
  for (const fn of Object.values(client)) fn.mockClear();
  client.transcriptionStatus.mockImplementation(async () => ({ state: 'done', facts: FACTS }));
});

describe('startTranscription', () => {
  it('holds the lock as a transcribe, then keeps the score and facts on the job', async () => {
    let calls = 0;
    client.transcriptionStatus.mockImplementation(async () =>
      (++calls < 3 ? { state: 'running', stage: 'transcribing', progress: 0.5 } : { state: 'done', facts: FACTS }));
    const job = startTranscription(engine, source);
    expect(getGenLock()).toMatchObject({ kind: 'transcribe', jobId: job.id, title: 'Ellies City 2', engine: 'yue2' });
    await vi.waitFor(() => expect(getJob(job.id)?.progressStage).toBe('transcribing'));
    expect(getJob(job.id)?.progress).toBe(0.5);
    await settle(job.id, 'done');

    expect(client.transcribe).toHaveBeenCalledWith(engine, source.data, 'ellies.wav', job.id);
    expect(client.fetchTranscriptionScore).toHaveBeenCalledWith(engine, 'remote-1');
    expect(getJob(job.id)?.transcription).toEqual({ ...FACTS, score: 'X:1\nK:Fm\n', sourceLabel: 'Ellies City 2' });
    expect(getJob(job.id)?.songId).toBeUndefined(); // nothing reaches the library
  });

  it('fails the job with the engine\'s message and frees the lock', async () => {
    client.transcriptionStatus.mockImplementation(async () => ({ state: 'failed', error: 'SheetSage2 built no score' }));
    const job = startTranscription(engine, source);
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('SheetSage2 built no score');
    expect(getJob(job.id)?.transcription).toBeUndefined();
  });

  it('asks the engine to stop when aborted', async () => {
    client.transcriptionStatus.mockImplementation(async () => ({ state: 'running' }));
    const job = startTranscription(engine, source);
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('running'));
    abortJob(job.id);
    await vi.waitFor(() => expect(client.cancelTranscription).toHaveBeenCalledWith(engine, 'remote-1'));
    expect(getGenLock()).toBeNull();
    expect(client.fetchTranscriptionScore).not.toHaveBeenCalled();
  });

  it('refuses to start while another job holds the lock', () => {
    acquireGenLock({ kind: 'generate', jobId: 'other' });
    try {
      expect(() => startTranscription(engine, source)).toThrow(GenLockError);
    } finally {
      releaseGenLock('other');
    }
  });
});
