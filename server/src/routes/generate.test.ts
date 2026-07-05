import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

vi.mock('../services/acestep.js', () => ({
  createRandomSample: vi.fn(async (sampleType: string) => ({
    caption: 'Upbeat pop song with guitar accompaniment',
    lyrics: '[Verse 1]\nSunshine on my face...',
    bpm: 120,
    key_scale: 'G Major',
    time_signature: '4',
    duration: 180,
    vocal_language: 'en',
    __sampleType: sampleType,
  })),
  createSampleFromQuery: vi.fn(async (params: { query: string }) => ({
    caption: `about: ${params.query}`,
    lyrics: '',
    bpm: 90,
    key_scale: 'Am',
    time_signature: '3',
    duration: 60,
    vocal_language: 'en',
  })),
  health: vi.fn(async () => true),
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
  formatInput: vi.fn(async () => ({ caption: '', lyrics: '' })),
}));
vi.mock('../services/jobs.js', () => ({ startGeneration: vi.fn(), getJob: vi.fn() }));

const acestep = await import('../services/acestep.js');
const { generateRouter } = await import('./generate.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/generate', generateRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/generate`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('POST /random-sample', () => {
  it('defaults to simple_mode and returns ACE-Step sample data', async () => {
    const res = await fetch(`${baseUrl}/random-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.caption).toBe('Upbeat pop song with guitar accompaniment');
    expect(body.__sampleType).toBe('simple_mode');
  });

  it('passes through custom_mode', async () => {
    const res = await fetch(`${baseUrl}/random-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_type: 'custom_mode' }),
    });
    const body = await res.json();
    expect(body.__sampleType).toBe('custom_mode');
  });

  it('returns 502 when ACE-Step is unreachable', async () => {
    vi.mocked(acestep.createRandomSample).mockRejectedValueOnce(new Error('ACE-Step unreachable'));
    const res = await fetch(`${baseUrl}/random-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(502);
  });
});

describe('POST /sample-from-query', () => {
  it('returns generated fields for a free-form query', async () => {
    const res = await fetch(`${baseUrl}/sample-from-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'sad indie rock ballad with reverb' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.caption).toBe('about: sad indie rock ballad with reverb');
  });

  it('rejects a missing query with 400', async () => {
    const res = await fetch(`${baseUrl}/sample-from-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('returns 502 when ACE-Step is unreachable', async () => {
    vi.mocked(acestep.createSampleFromQuery).mockRejectedValueOnce(new Error('ACE-Step unreachable'));
    const res = await fetch(`${baseUrl}/sample-from-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'anything' }),
    });
    expect(res.status).toBe(502);
  });
});
