import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  healthState: vi.fn(async () => 'up'),
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
  formatInput: vi.fn(async () => ({ caption: '', lyrics: '' })),
}));
vi.mock('../services/jobs.js', () => ({
  startGeneration: vi.fn(async () => ({ id: 'gen-job-1' })),
  getJob: vi.fn(),
  getActiveGeneration: vi.fn(() => ({ lock: null })),
  abortJob: vi.fn(),
}));
vi.mock('../services/sampleJobs.js', () => ({ startSample: vi.fn(() => ({ id: 'sample-job-1' })) }));
vi.mock('../services/coverGenJobs.js', () => ({ startCoverGeneration: vi.fn(() => ({ id: 'cover-job-1' })) }));
vi.mock('../services/completeGenJobs.js', () => ({ startCompleteGeneration: vi.fn(() => ({ id: 'complete-job-1' })) }));
vi.mock('../services/scratchSplitJobs.js', () => ({
  getScratchSplitJob: vi.fn(),
  scratchStemPath: vi.fn(),
  SCRATCH_GONE: 'stems expired',
}));
vi.mock('../services/referenceAudioResolve.js', () => ({
  // Default behavior mirrors the real function's "pass through an uploaded file as-is" branch —
  // individual tests override with mockResolvedValueOnce to exercise the voice_id branch.
  resolveReferenceAudioFile: vi.fn(async (uploaded?: { data: Buffer; filename: string }) => uploaded),
}));

const acestep = await import('../services/acestep.js');
const jobs = await import('../services/jobs.js');
const sampleJobs = await import('../services/sampleJobs.js');
const { QueueFullError } = await import('../services/genQueue.js');
const coverGenJobs = await import('../services/coverGenJobs.js');
const completeGenJobs = await import('../services/completeGenJobs.js');
const scratchSplitJobs = await import('../services/scratchSplitJobs.js');
const referenceAudioResolve = await import('../services/referenceAudioResolve.js');
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

describe('POST /', () => {
  it('accepts a plain JSON body unchanged, with no reference audio', async () => {
    vi.mocked(jobs.startGeneration).mockClear();
    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Song', prompt: 'a driving synthwave track', bpm: 120 }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe('gen-job-1');

    const [params, title, voice] = vi.mocked(jobs.startGeneration).mock.calls[0];
    expect(params.prompt).toBe('a driving synthwave track');
    expect(params.bpm).toBe(120); // untouched — no numeric-string coercion needed for JSON
    expect(title).toBe('My Song');
    expect(voice?.referenceAudioFile).toBeUndefined();
  });

  it('accepts a multipart body with an ad-hoc reference-audio upload', async () => {
    vi.mocked(jobs.startGeneration).mockClear();
    const form = new FormData();
    form.append('title', 'My Song');
    form.append('prompt', 'a driving synthwave track');
    form.append('bpm', '120');
    form.append('audio_cover_strength', '0.3');
    form.append('reference_audio', new Blob([Buffer.from('ref-bytes')]), 'ref.wav');

    const res = await fetch(`${baseUrl}/`, { method: 'POST', body: form });
    expect(res.status).toBe(202);

    const [params, , voice] = vi.mocked(jobs.startGeneration).mock.calls[0];
    expect(params.bpm).toBe(120); // coerced from the multipart string '120'
    expect(params).not.toHaveProperty('audio_cover_strength'); // cover-only, see jobs.ts
    expect(voice?.referenceAudioFile?.data.toString()).toBe('ref-bytes');
  });

  it('decodes multipart booleans and the JSON-encoded output block', async () => {
    vi.mocked(jobs.startGeneration).mockClear();
    const form = new FormData();
    form.append('title', 'My Song');
    form.append('prompt', 'p');
    form.append('thinking', 'false');
    form.append('use_format', 'false');
    form.append('use_random_seed', 'false');
    form.append('seed', '42');
    form.append('output', JSON.stringify({ format: 'wav', sampleRate: 44100, bitDepth: 16, mp3Bitrate: 320 }));
    form.append('reference_audio', new Blob([Buffer.from('ref-bytes')]), 'ref.wav');

    const res = await fetch(`${baseUrl}/`, { method: 'POST', body: form });
    expect(res.status).toBe(202);

    const [params] = vi.mocked(jobs.startGeneration).mock.calls[0];
    // Boolean('false') is truthy — these must come through as real false values.
    expect(params.thinking).toBe(false);
    expect(params.use_format).toBe(false);
    expect(params.use_random_seed).toBe(false);
    expect(params.seed).toBe(42);
    expect(params.output).toEqual({ format: 'wav', sampleRate: 44100, bitDepth: 16, mp3Bitrate: 320 });
  });

  it('passes the output block through on the plain-JSON path', async () => {
    vi.mocked(jobs.startGeneration).mockClear();
    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 't', prompt: 'p', output: { format: 'mp3', sampleRate: 48000, bitDepth: 24, mp3Bitrate: 192 } }),
    });
    expect(res.status).toBe(202);
    const [params] = vi.mocked(jobs.startGeneration).mock.calls[0];
    expect(params.output).toEqual({ format: 'mp3', sampleRate: 48000, bitDepth: 24, mp3Bitrate: 192 });
  });
});

describe('POST /random-sample', () => {
  const post = (body: string) => fetch(`${baseUrl}/random-sample`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });

  it('queues a sample job (simple_mode by default) and answers its jobId', async () => {
    vi.mocked(sampleJobs.startSample).mockClear();
    const res = await post('{}');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'sample-job-1' });
    expect(sampleJobs.startSample).toHaveBeenCalledWith('simple_mode');
  });

  it('passes through custom_mode', async () => {
    await post(JSON.stringify({ sample_type: 'custom_mode' }));
    expect(sampleJobs.startSample).toHaveBeenLastCalledWith('custom_mode');
  });

  it('answers 409 with the reason when the queue is full', async () => {
    vi.mocked(sampleJobs.startSample).mockImplementationOnce(() => { throw new QueueFullError(); });
    const res = await post('{}');
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('the queue is full');
  });
});

describe('POST /from-audio', () => {
  it('rejects a missing src_audio file with 400', async () => {
    const form = new FormData();
    form.append('title', 'My Cover');
    const res = await fetch(`${baseUrl}/from-audio`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
  });

  it('starts a cover generation from the uploaded file and coerces numeric fields', async () => {
    vi.mocked(coverGenJobs.startCoverGeneration).mockClear();
    const form = new FormData();
    form.append('title', 'My Cover');
    form.append('prompt', 'a driving synthwave track');
    form.append('model', 'acestep-v15-xl-sft');
    form.append('bpm', '128');
    form.append('src_audio', new Blob([Buffer.from('audio-bytes')]), 'source.wav');

    const res = await fetch(`${baseUrl}/from-audio`, { method: 'POST', body: form });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe('cover-job-1');

    expect(coverGenJobs.startCoverGeneration).toHaveBeenCalledTimes(1);
    const [buf, title, params] = vi.mocked(coverGenJobs.startCoverGeneration).mock.calls[0];
    expect(buf.toString()).toBe('audio-bytes');
    expect(title).toBe('My Cover');
    expect(params.prompt).toBe('a driving synthwave track');
    expect(params.bpm).toBe(128);
  });

  it.each([
    ['0.35', 0.35],
    ['1.7', 1],
    ['-0.2', 0],
  ])('forwards audio_cover_strength %s to the cover job as the number %d', async (sent, expected) => {
    vi.mocked(coverGenJobs.startCoverGeneration).mockClear();
    const form = new FormData();
    form.append('audio_cover_strength', sent);
    form.append('src_audio', new Blob([Buffer.from('audio-bytes')]), 'source.wav');

    const res = await fetch(`${baseUrl}/from-audio`, { method: 'POST', body: form });
    expect(res.status).toBe(202);
    const [, , params] = vi.mocked(coverGenJobs.startCoverGeneration).mock.calls[0];
    expect(params.audio_cover_strength).toBe(expected);
  });

  it('omits audio_cover_strength when it is absent or not a number', async () => {
    vi.mocked(coverGenJobs.startCoverGeneration).mockClear();
    const form = new FormData();
    form.append('audio_cover_strength', 'abc');
    form.append('src_audio', new Blob([Buffer.from('audio-bytes')]), 'source.wav');

    await fetch(`${baseUrl}/from-audio`, { method: 'POST', body: form });
    const [, , params] = vi.mocked(coverGenJobs.startCoverGeneration).mock.calls[0];
    expect(params).not.toHaveProperty('audio_cover_strength');
  });

  it('resolves reference audio via voice_id when no reference_audio file is uploaded', async () => {
    vi.mocked(referenceAudioResolve.resolveReferenceAudioFile).mockClear();
    vi.mocked(referenceAudioResolve.resolveReferenceAudioFile).mockResolvedValueOnce({ data: Buffer.from('voice-bytes'), filename: 'voice.wav' });

    const form = new FormData();
    form.append('title', 'My Cover');
    form.append('voice_id', 'voice-1');
    form.append('src_audio', new Blob([Buffer.from('audio-bytes')]), 'source.wav');

    const res = await fetch(`${baseUrl}/from-audio`, { method: 'POST', body: form });
    expect(res.status).toBe(202);

    const [, voiceId] = vi.mocked(referenceAudioResolve.resolveReferenceAudioFile).mock.calls[0];
    expect(voiceId).toBe('voice-1');
    const [, , , referenceAudio] = vi.mocked(coverGenJobs.startCoverGeneration).mock.calls.at(-1)!;
    expect(referenceAudio?.data.toString()).toBe('voice-bytes');
  });
});

describe('POST /complete', () => {
  it('rejects when neither src_audio nor a scratch stem reference is provided', async () => {
    const form = new FormData();
    form.append('title', 'My Complete');
    const res = await fetch(`${baseUrl}/complete`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
  });

  it('starts a complete generation from an uploaded track plus optional reference audio', async () => {
    vi.mocked(completeGenJobs.startCompleteGeneration).mockClear();
    const form = new FormData();
    form.append('title', 'My Complete');
    form.append('prompt', 'add a full band');
    form.append('model', 'acestep-v15-xl-base');
    form.append('audio_cover_strength', '0.3');
    form.append('src_audio', new Blob([Buffer.from('vocals-bytes')]), 'vocals.wav');
    form.append('reference_audio', new Blob([Buffer.from('ref-bytes')]), 'ref.wav');

    const res = await fetch(`${baseUrl}/complete`, { method: 'POST', body: form });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe('complete-job-1');

    expect(completeGenJobs.startCompleteGeneration).toHaveBeenCalledTimes(1);
    const [src, title, params, ref] = vi.mocked(completeGenJobs.startCompleteGeneration).mock.calls[0];
    expect(src.data.toString()).toBe('vocals-bytes');
    expect(title).toBe('My Complete');
    expect(params.prompt).toBe('add a full band');
    expect(params).not.toHaveProperty('audio_cover_strength');
    expect(ref?.data.toString()).toBe('ref-bytes');
  });

  it('resolves the source from a scratch split job when no file is uploaded', async () => {
    vi.mocked(completeGenJobs.startCompleteGeneration).mockClear();
    const stemFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-')), 'vocals.mp3');
    fs.writeFileSync(stemFile, 'stem-bytes');
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce({ id: 'scratch-1' } as never);
    vi.mocked(scratchSplitJobs.scratchStemPath).mockReturnValueOnce(stemFile);

    const form = new FormData();
    form.append('title', 'My Complete');
    form.append('scratch_job_id', 'scratch-1');
    form.append('scratch_stem_kind', 'vocals');

    const res = await fetch(`${baseUrl}/complete`, { method: 'POST', body: form });
    expect(res.status).toBe(202);
    expect(completeGenJobs.startCompleteGeneration).toHaveBeenCalledTimes(1);
  });

  it('returns 400 saying the stems expired for a discarded or evicted scratch split', async () => {
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce(undefined);
    const form = new FormData();
    form.append('title', 'My Complete');
    form.append('scratch_job_id', 'nope');
    form.append('scratch_stem_kind', 'vocals');

    const res = await fetch(`${baseUrl}/complete`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'stems expired' });
  });
});

describe('GET /:jobId', () => {
  it('includes progress/progressStage/progressText alongside status/songId/error', async () => {
    vi.mocked(jobs.getJob).mockReturnValueOnce({
      id: 'job-progress-1', taskId: 't', status: 'running', createdAt: Date.now(),
      progress: 0.42, progressStage: 'sampling', progressText: 'step 12/50',
    });
    const res = await fetch(`${baseUrl}/job-progress-1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'running', progress: 0.42, progressStage: 'sampling', progressText: 'step 12/50' });
  });

  it('carries a finished transcription\'s score and facts, and nothing extra otherwise', async () => {
    const transcription = {
      score: 'X:1\nK:Fm\n', sourceLabel: 'Ellies City 2', warnings: [], measures: 44, vocalNotes: 167,
      instrumentalNotes: 16, durationSeconds: 140, hasPreview: true,
      sectionStarts: [{ label: 'intro', bar: 0, seconds: 0.01 }],
    };
    vi.mocked(jobs.getJob).mockReturnValueOnce({ id: 'tr-1', taskId: 't', status: 'done', createdAt: Date.now(), transcription });
    expect(await (await fetch(`${baseUrl}/tr-1`)).json()).toMatchObject({ status: 'done', transcription });
    vi.mocked(jobs.getJob).mockReturnValueOnce({ id: 'g-1', taskId: 't', status: 'done', createdAt: Date.now(), songId: 's' });
    expect(await (await fetch(`${baseUrl}/g-1`)).json()).not.toHaveProperty('transcription');
  });

  it('returns 404 for an unknown job', async () => {
    vi.mocked(jobs.getJob).mockReturnValueOnce(undefined);
    const res = await fetch(`${baseUrl}/unknown-job`);
    expect(res.status).toBe(404);
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

describe('GET /models', () => {
  it('passes ACE-Step\'s inventory through, including an empty one', async () => {
    vi.mocked(acestep.listModels).mockResolvedValueOnce({ models: [], lmModels: [], defaultModel: null });
    const res = await fetch(`${baseUrl}/models`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ models: [], lmModels: [], defaultModel: null });
  });

  it('answers 502 with the reason when ACE-Step cannot be asked, not an empty inventory', async () => {
    vi.mocked(acestep.listModels).mockRejectedValueOnce(new Error('ACE-Step unreachable at http://127.0.0.1:8001 (ECONNREFUSED)'));
    const res = await fetch(`${baseUrl}/models`);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'ACE-Step unreachable at http://127.0.0.1:8001 (ECONNREFUSED)' });
  });
  it('waits the longer lookup deadline, since ACE-Step answers nothing while it generates', async () => {
    const { config } = await import('../config.js');
    await fetch(`${baseUrl}/models`);
    expect(acestep.listModels).toHaveBeenLastCalledWith(config.acestepLookupTimeoutMs);
    expect(config.acestepLookupTimeoutMs).toBeGreaterThan(config.acestepTimeoutMs);
  });
});
