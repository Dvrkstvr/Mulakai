import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../services/acestep.js', () => ({
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('../services/stemSplit.js', () => ({
  getSplitJob: vi.fn(),
  claimStem: vi.fn(),
  reextractStem: vi.fn(),
  cancelSplit: vi.fn(),
}));
vi.mock('../services/scratchSplitJobs.js', () => ({
  startScratchSplit: vi.fn(async () => ({ id: 'scratch-job-1' })),
  getScratchSplitJob: vi.fn(),
  discardScratchSplit: vi.fn(async () => undefined),
  scratchStemPath: vi.fn(),
}));

const scratchSplitJobs = await import('../services/scratchSplitJobs.js');
const { splitRouter } = await import('./split.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/split', splitRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/split`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('POST /scratch', () => {
  it('rejects a missing audio file with 400', async () => {
    const form = new FormData();
    const res = await fetch(`${baseUrl}/scratch`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
  });

  it('starts a scratch split job from the uploaded file, defaulting to acestep', async () => {
    vi.mocked(scratchSplitJobs.startScratchSplit).mockClear();
    const form = new FormData();
    form.append('audio', new Blob([Buffer.from('song-bytes')]), 'song.wav');

    const res = await fetch(`${baseUrl}/scratch`, { method: 'POST', body: form });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe('scratch-job-1');

    const [src, model] = vi.mocked(scratchSplitJobs.startScratchSplit).mock.calls[0];
    expect(src.data.toString()).toBe('song-bytes');
    expect(model).toBe('acestep');
  });

  it('honors an explicit demucs model choice', async () => {
    vi.mocked(scratchSplitJobs.startScratchSplit).mockClear();
    const form = new FormData();
    form.append('audio', new Blob([Buffer.from('song-bytes')]), 'song.wav');
    form.append('model', 'demucs');

    await fetch(`${baseUrl}/scratch`, { method: 'POST', body: form });
    const [, model] = vi.mocked(scratchSplitJobs.startScratchSplit).mock.calls[0];
    expect(model).toBe('demucs');
  });
});

describe('GET /scratch/:jobId', () => {
  it('404s for an unknown job', async () => {
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce(undefined);
    const res = await fetch(`${baseUrl}/scratch/unknown`);
    expect(res.status).toBe(404);
  });

  it('reports done once every stem has settled', async () => {
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce({
      id: 'scratch-job-1',
      model: 'acestep',
      outDir: '/tmp/x',
      createdAt: Date.now(),
      stems: [
        { kind: 'vocals', status: 'done', audioFile: 'a.mp3' },
        { kind: 'drums', status: 'done', audioFile: 'b.mp3' },
        { kind: 'bass', status: 'done', audioFile: 'c.mp3' },
        { kind: 'other', status: 'done', audioFile: 'd.mp3' },
      ],
    } as never);
    const res = await fetch(`${baseUrl}/scratch/scratch-job-1`);
    const body = await res.json();
    expect(body.status).toBe('done');
    expect(body.stems).toHaveLength(4);
  });
});

describe('GET /scratch/:jobId/:kind/download', () => {
  it('streams the stem file when ready', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
    const filePath = path.join(dir, 'vocals.mp3');
    fs.writeFileSync(filePath, 'stem-bytes');
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce({ id: 'scratch-job-1' } as never);
    vi.mocked(scratchSplitJobs.scratchStemPath).mockReturnValueOnce(filePath);

    const res = await fetch(`${baseUrl}/scratch/scratch-job-1/vocals/download`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('stem-bytes');
  });

  it('404s for a stem that is not ready yet', async () => {
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce({ id: 'scratch-job-1' } as never);
    vi.mocked(scratchSplitJobs.scratchStemPath).mockReturnValueOnce(undefined);

    const res = await fetch(`${baseUrl}/scratch/scratch-job-1/vocals/download`);
    expect(res.status).toBe(404);
  });

  it('400s for an unknown stem kind', async () => {
    vi.mocked(scratchSplitJobs.getScratchSplitJob).mockReturnValueOnce({ id: 'scratch-job-1' } as never);
    const res = await fetch(`${baseUrl}/scratch/scratch-job-1/kazoo/download`);
    expect(res.status).toBe(400);
  });
});

describe('POST /scratch/:jobId/discard', () => {
  it('discards the job', async () => {
    vi.mocked(scratchSplitJobs.discardScratchSplit).mockClear();
    const res = await fetch(`${baseUrl}/scratch/scratch-job-1/discard`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(scratchSplitJobs.discardScratchSplit).toHaveBeenCalledWith('scratch-job-1');
  });
});
