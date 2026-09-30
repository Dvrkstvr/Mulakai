import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { SongEngine } from '../services/engines/types.js';

const yue: Partial<SongEngine> = { id: 'yue2', label: 'YUE2', url: 'http://127.0.0.1:9000' };
const offline: Partial<SongEngine> = { id: 'heartmula', label: 'HEARTMULA', url: '' };

vi.mock('../services/engines/registry.js', () => ({
  listEngines: vi.fn(async () => [{ id: 'acestep', label: 'ACE-STEP', configured: true, ready: true }]),
  getEngine: vi.fn((id: string) => [yue, offline].find((e) => e.id === id)),
}));
vi.mock('../services/engineGenJobs.js', () => ({ startEngineGeneration: vi.fn(() => ({ id: 'engine-job-1' })) }));

const { startEngineGeneration } = await import('../services/engineGenJobs.js');
const { GenLockError } = await import('../services/genLock.js');
const { enginesRouter, pickCreateFields } = await import('./engines.js');
const start = vi.mocked(startEngineGeneration);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/engines', enginesRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/engines`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => start.mockClear());

const post = (id: string, body: unknown) =>
  fetch(`${baseUrl}/${id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('GET /api/engines', () => {
  it('returns the registry list', async () => {
    const res = await fetch(baseUrl);
    expect(await res.json()).toEqual([{ id: 'acestep', label: 'ACE-STEP', configured: true, ready: true }]);
  });
});

describe('POST /api/engines/:id/generate', () => {
  it('starts an engine job from the Create fields and answers 202 with its id', async () => {
    const res = await post('yue2', { title: 'My Song', folder_id: 'f1', prompt: 'pop', lyrics: 'la', seed: 7, model: 'acestep-v15' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'engine-job-1' });
    expect(start).toHaveBeenCalledWith(yue, { prompt: 'pop', lyrics: 'la', seed: 7 }, 'My Song', 'f1');
  });

  it("defaults the title to 'Untitled'", async () => {
    await post('yue2', { prompt: 'pop' });
    expect(start.mock.calls[0][2]).toBe('Untitled');
  });

  it('404s an unknown engine', async () => {
    expect((await post('minimax', {})).status).toBe(404);
  });

  it('400s ACE-Step, which has its own route', async () => {
    expect((await post('acestep', {})).status).toBe(400);
  });

  it('400s an engine with no URL configured', async () => {
    const res = await post('heartmula', {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('HEARTMULA is not configured');
    expect(start).not.toHaveBeenCalled();
  });

  it('409s while another generation holds the lock', async () => {
    start.mockImplementationOnce(() => { throw new GenLockError(); });
    expect((await post('yue2', { prompt: 'pop' })).status).toBe(409);
  });
});

describe('pickCreateFields', () => {
  it('keeps the Create fields and engine controls, dropping everything ACE-Step-only', () => {
    expect(pickCreateFields({
      prompt: 'p', lyrics: 'l', bpm: 92, key_scale: 'A minor', time_signature: '6', vocal_language: 'en',
      audio_duration: 120, guidance_scale: 5, use_random_seed: false, seed: 3, output: { format: 'mp3' },
      cfg: 1.5, temperature: 0.9, top_k: 50, cot: 'melody',
      model: 'x', thinking: true, inference_steps: 8, batch_size: 2,
    })).toEqual({
      prompt: 'p', lyrics: 'l', bpm: 92, key_scale: 'A minor', time_signature: '6', vocal_language: 'en',
      audio_duration: 120, guidance_scale: 5, use_random_seed: false, seed: 3, output: { format: 'mp3' },
      cfg: 1.5, temperature: 0.9, top_k: 50, cot: 'melody',
    });
  });

  it('drops mistyped values, which is AUTO', () => {
    expect(pickCreateFields({ bpm: '92', seed: Number.NaN, use_random_seed: 'true', cot: 'maybe', prompt: 5 })).toEqual({});
  });
});
