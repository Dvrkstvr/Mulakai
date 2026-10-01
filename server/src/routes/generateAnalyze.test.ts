import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The real genLock and the real startGeneration (jobs.ts): a refused generate has to be the
// same 409 a second tab gets, not a mock's say-so. Only ACE-Step's analyze call is faked.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-analyze-test-'));
process.env.ACESTEP_API_URL = 'http://acestep.test';
process.env.ACESTEP_TIMEOUT_MS = '100';

vi.mock('../services/acestep.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/acestep.js')>()),
  analyzeAudio: vi.fn(),
}));

const acestep = await import('../services/acestep.js');
const realAcestep = await vi.importActual<typeof import('../services/acestep.js')>('../services/acestep.js');
const { acquireGenLock, releaseGenLock, getGenLock } = await import('../services/genLock.js');
const { analyzeUnderLock } = await import('../services/analyzeJobs.js');
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
  const lock = getGenLock();
  if (lock) releaseGenLock(lock.jobId);
});

function analyze(): Promise<Response> {
  const form = new FormData();
  form.append('src_audio', new Blob([new Uint8Array([1, 2, 3])]), 'song.wav');
  return fetch(`${baseUrl}/analyze-audio`, { method: 'POST', body: form });
}

function generate(): Promise<Response> {
  return fetch(`${baseUrl}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Other tab', prompt: 'synthwave' }),
  });
}

describe('POST /analyze-audio and the genLock', () => {
  it('holds an `analyze` lock while ACE-Step listens, refuses a generate meanwhile, then releases it', async () => {
    let finish!: (r: typeof RESULT) => void;
    vi.mocked(acestep.analyzeAudio).mockImplementation(() => new Promise((r) => { finish = r; }));

    const pending = analyze();
    await vi.waitFor(() => expect(acestep.analyzeAudio).toHaveBeenCalled());

    expect(getGenLock()).toMatchObject({ kind: 'analyze', title: 'song.wav' });
    const active = await (await fetch(`${baseUrl}/active`)).json();
    expect(active.active).toMatchObject({ kind: 'analyze', status: 'running' });

    const refused = await generate();
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toBe('an audio analysis is already in progress');

    finish(RESULT);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    expect(getGenLock()).toBeNull();
  });

  it('releases the lock when ACE-Step fails', async () => {
    vi.mocked(acestep.analyzeAudio).mockRejectedValue(new Error('ACE-Step /v1/analyze_audio -> DiT not initialized'));

    const res = await analyze();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/DiT not initialized/);
    expect(getGenLock()).toBeNull();
  });

  it('releases the lock when the ACE-Step call times out', async () => {
    // The real analyzeAudio against a socket that never answers: call()'s own leash fires.
    vi.mocked(acestep.analyzeAudio).mockImplementation(realAcestep.analyzeAudio);
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    })));

    await expect(analyzeUnderLock({ data: Buffer.from([1]), filename: 'song.wav' })).rejects.toThrow(/no response within/);
    expect(getGenLock()).toBeNull();
  });

  it('is refused while another job holds the lock, without calling ACE-Step', async () => {
    acquireGenLock({ kind: 'repaint', jobId: 'repaint-1', songId: 'song-1' });

    const res = await analyze();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('a repaint is already in progress');
    expect(acestep.analyzeAudio).not.toHaveBeenCalled();
    expect(getGenLock()?.jobId).toBe('repaint-1');
  });

  it('still answers 400 for a missing source without touching the lock', async () => {
    const res = await fetch(`${baseUrl}/analyze-audio`, { method: 'POST', body: new FormData() });
    expect(res.status).toBe(400);
    expect(getGenLock()).toBeNull();
  });
});
