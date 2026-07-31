import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

vi.mock('../services/addLayerJobs.js', () => ({
  startAddLayer: vi.fn(async () => ({ id: 'addlayer-job-1' })),
}));

const express = (await import('express')).default;
const { startAddLayer } = await import('../services/addLayerJobs.js');
const { songLayersRouter } = await import('./songLayers.js');

const app = express();
app.use('/api/songs', songLayersRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}/api/songs`;
      resolve();
    });
  });
});

afterAll(() => server.close());

beforeEach(() => vi.mocked(startAddLayer).mockClear());

function postAddLayer(fields: Record<string, string>) {
  const form = new FormData();
  form.append('prompt', 'add a bass line');
  form.append('mix_audio', new Blob(['fake mix bytes']), 'mix.wav');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return fetch(`${baseUrl}/s1/layers`, { method: 'POST', body: form });
}

describe('POST /:id/layers multipart coercion', () => {
  it('honors a pinned seed sent as the multipart string "false"', async () => {
    const res = await postAddLayer({ use_random_seed: 'false', seed: '42' });
    expect(res.status).toBe(202);

    const params = vi.mocked(startAddLayer).mock.calls[0][4];
    expect(params).toMatchObject({ use_random_seed: false, seed: 42 });
  });

  it('decodes "false" strings for thinking/use_format/use_adg as false', async () => {
    await postAddLayer({ thinking: 'false', use_format: 'false', use_adg: 'false' });

    const params = vi.mocked(startAddLayer).mock.calls[0][4];
    expect(params).toMatchObject({ thinking: false, use_format: false, use_adg: false });
  });

  it('decodes "true" strings as true and omits an unpinned seed', async () => {
    await postAddLayer({ thinking: 'true', use_random_seed: 'true', seed: '42' });

    const params = vi.mocked(startAddLayer).mock.calls[0][4];
    expect(params).toMatchObject({ thinking: true });
    expect(params).not.toHaveProperty('use_random_seed');
    expect(params).not.toHaveProperty('seed');
  });
});
