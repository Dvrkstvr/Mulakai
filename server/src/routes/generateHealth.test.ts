import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

vi.mock('../services/acestep.js', () => ({ healthState: vi.fn(async () => 'up') }));

const acestep = await import('../services/acestep.js');
const { enqueue, resetQueue } = await import('../services/genQueue.js');
const { generateHelpersRouter } = await import('./generateHelpers.js');

let server: Server;
let url: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/generate', generateHelpersRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/generate/health`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => resetQueue());
const hold = () => enqueue({ kind: 'generate', jobId: 'job-1' }, () => new Promise(() => {}));

const get = async () => (await fetch(url)).json();

describe('GET /health', () => {
  it('reports an answering ACE-Step as up and not busy', async () => {
    vi.mocked(acestep.healthState).mockResolvedValueOnce('up');
    expect(await get()).toEqual({ acestep: true, busy: false });
  });

  it('reads silence while a job runs as busy', async () => {
    hold();
    vi.mocked(acestep.healthState).mockResolvedValueOnce('silent');
    expect(await get()).toEqual({ acestep: false, busy: true });
  });

  it('reads silence with no job running as down', async () => {
    vi.mocked(acestep.healthState).mockResolvedValueOnce('silent');
    expect(await get()).toEqual({ acestep: false, busy: false });
  });

  it('never calls a refused connection busy, even mid-job', async () => {
    hold();
    vi.mocked(acestep.healthState).mockResolvedValueOnce('down');
    expect(await get()).toEqual({ acestep: false, busy: false });
  });
});
