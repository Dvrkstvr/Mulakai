import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The real queue and the real startGeneration (jobs.ts): a generate queued behind an analysis
// is what a second tab gets, not a mock's say-so. Only ACE-Step's analyze call is faked.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-analyze-test-'));
process.env.ACESTEP_API_URL = 'http://acestep.test';
process.env.ACESTEP_TIMEOUT_MS = '100';

vi.mock('../services/acestep.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/acestep.js')>()),
  analyzeAudio: vi.fn(),
}));

const acestep = await import('../services/acestep.js');
const realAcestep = await vi.importActual<typeof import('../services/acestep.js')>('../services/acestep.js');
const { enqueue, getRunning, resetQueue } = await import('../services/genQueue.js');
const { generateRouter } = await import('./generate.js');

const RESULT = { caption: 'a piano ballad', lyrics: '' };

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/generate', generateRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/generate`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

afterEach(() => {
  vi.mocked(acestep.analyzeAudio).mockReset();
  vi.unstubAllGlobals();
  resetQueue();
});

async function analyze(): Promise<string> {
  const form = new FormData();
  form.append('src_audio', new Blob([new Uint8Array([1, 2, 3])]), 'song.wav');
  const res = await fetch(`${baseUrl}/analyze-audio`, { method: 'POST', body: form });
  expect(res.status).toBe(202);
  return ((await res.json()) as { jobId: string }).jobId;
}

const status = async (jobId: string) => (await fetch(`${baseUrl}/${jobId}`)).json();

function generate(): Promise<Response> {
  return fetch(`${baseUrl}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Other tab', prompt: 'synthwave' }),
  });
}

describe('POST /analyze-audio as a queued job', () => {
  it('runs as `analyze`, queues a generate behind it, and carries the analysis on the polled job', async () => {
    let finish!: (r: typeof RESULT) => void;
    vi.mocked(acestep.analyzeAudio).mockImplementation(() => new Promise((r) => { finish = r; }));

    const jobId = await analyze();
    await vi.waitFor(() => expect(acestep.analyzeAudio).toHaveBeenCalled());
    expect(getRunning()).toMatchObject({ kind: 'analyze', title: 'song.wav', jobId });
    const active = await (await fetch(`${baseUrl}/active`)).json();
    expect(active.active).toMatchObject({ kind: 'analyze', status: 'running' });

    const queued = await generate();
    expect(queued.status).toBe(202);
    const genId = ((await queued.json()) as { jobId: string }).jobId;
    expect(await status(genId)).toMatchObject({ status: 'queued', queuePosition: 1 });
    // CANCEL the waiting generate so it never reaches the (unreachable) ACE-Step.
    expect((await fetch(`${baseUrl}/${genId}/cancel`, { method: 'POST' })).status).toBe(200);
    expect(await status(genId)).toMatchObject({ status: 'failed', error: 'cancelled', cancelled: true });

    finish(RESULT);
    await vi.waitFor(async () => expect(await status(jobId)).toMatchObject({ status: 'done', analysis: RESULT }));
    expect(getRunning()).toBeNull();
  });

  it('fails the job and frees the slot when ACE-Step fails', async () => {
    vi.mocked(acestep.analyzeAudio).mockRejectedValue(new Error('ACE-Step /v1/analyze_audio -> DiT not initialized'));

    const jobId = await analyze();
    await vi.waitFor(async () => expect((await status(jobId)).status).toBe('failed'));
    expect((await status(jobId)).error).toMatch(/DiT not initialized/);
    expect(getRunning()).toBeNull();
  });

  it('fails the job and frees the slot when the ACE-Step call times out', async () => {
    // The real analyzeAudio against a socket that never answers: call()'s own leash fires.
    vi.mocked(acestep.analyzeAudio).mockImplementation(realAcestep.analyzeAudio);
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => (String(url).startsWith('http://acestep.test')
      ? new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)); })
      : realFetch(url, init))));

    const jobId = await analyze();
    await vi.waitFor(async () => expect((await status(jobId)).error).toMatch(/no response within/));
    expect(getRunning()).toBeNull();
  });

  it('waits behind another job without calling ACE-Step until it finishes', async () => {
    vi.mocked(acestep.analyzeAudio).mockResolvedValue(RESULT);
    let free!: () => void;
    enqueue({ kind: 'repaint', jobId: 'repaint-1', songId: 'song-1' }, () => new Promise<void>((r) => { free = r; }));

    const jobId = await analyze();
    expect(await status(jobId)).toMatchObject({ status: 'queued', queuePosition: 1 });
    expect(acestep.analyzeAudio).not.toHaveBeenCalled();
    free();
    await vi.waitFor(async () => expect(await status(jobId)).toMatchObject({ status: 'done', analysis: RESULT }));
  });

  it('still answers 400 for a missing source without queueing anything', async () => {
    const res = await fetch(`${baseUrl}/analyze-audio`, { method: 'POST', body: new FormData() });
    expect(res.status).toBe(400);
    expect(getRunning()).toBeNull();
  });
});
