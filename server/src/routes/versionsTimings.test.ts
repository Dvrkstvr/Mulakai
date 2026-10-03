import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-versions-timings-test-'));

const startVersionTimings = vi.fn((_id: string): { id: string } => ({ id: 'job-1' }));
vi.mock('../services/timingsJobs.js', () => ({
  TIMINGS_NOT_SET_UP: 'word timings are not set up: LYRICS_API_URL is unset',
  startVersionTimings: (id: string) => startVersionTimings(id),
}));

const { QueueFullError } = await import('../services/genQueue.js');
const { versionsRouter } = await import('./versions.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/layers', versionsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/layers`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = () => fetch(`${baseUrl}/versions/v1/timings`, { method: 'POST' });

describe('POST /versions/:versionId/timings', () => {
  it('starts the read for that version and answers 202 with the job', async () => {
    const res = await post();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'job-1' });
    expect(startVersionTimings).toHaveBeenCalledWith('v1');
  });

  it.each([
    [new Error('unknown version'), 404],
    [new Error('word timings are not set up: LYRICS_API_URL is unset'), 400],
    [new QueueFullError(), 409],
    [new Error('disk on fire'), 500],
  ])('maps %s to %i', async (err, status) => {
    startVersionTimings.mockImplementationOnce(() => { throw err; });
    const res = await post();
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(err.message);
  });
});
