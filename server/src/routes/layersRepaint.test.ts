import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

vi.mock('../services/repaintJobs.js', () => ({
  startRepaint: vi.fn(async () => ({ id: 'repaint-job-1' })),
}));

const express = (await import('express')).default;
const { db } = await import('../db/index.js');
const { startRepaint } = await import('../services/repaintJobs.js');
const { layersRouter } = await import('./layers.js');

const app = express();
app.use(express.json());
app.use('/api/layers', layersRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/layers`;
      resolve();
    });
  });
  const song = (id: string, duration: number | null) => {
    db.prepare(`INSERT INTO songs (id, title, duration) VALUES (?, ?, ?)`).run(id, id, duration);
    db.prepare(`INSERT INTO layers (id, song_id, name) VALUES (?, ?, 'base')`).run(`${id}-base`, id);
  };
  song('short', 60);
  song('long', 192);
  song('unknown', null);
});

afterAll(() => server.close());

beforeEach(() => vi.mocked(startRepaint).mockClear());

const repaint = (layerId: string, body: Record<string, unknown>) => fetch(`${baseUrl}/${layerId}/repaint`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'brighter', ...body }),
});

describe('POST /:id/repaint range', () => {
  it('repaints a whole layer (end -1) of a song within the 90 s limit', async () => {
    const res = await repaint('short-base', { start: 0, end: -1 });
    expect(res.status).toBe(202);
    expect(vi.mocked(startRepaint).mock.calls[0][1]).toMatchObject({ repainting_start: 0, repainting_end: -1 });
  });

  it('refuses a whole-layer repaint of a song longer than 90 s, as it would a 192 s region', async () => {
    const res = await repaint('long-base', { start: 0, end: -1 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/whole layer needs 3-90s \(this one is 192\.0s\)/);
    expect(startRepaint).not.toHaveBeenCalled();
  });

  it("refuses a whole-layer repaint when the song's length isn't known", async () => {
    const res = await repaint('unknown-base', { start: 0, end: -1 });
    expect(res.status).toBe(400);
    expect(startRepaint).not.toHaveBeenCalled();
  });

  it('answers 404 for a whole-layer repaint of an unknown layer', async () => {
    expect((await repaint('nope', { start: 0, end: -1 })).status).toBe(404);
  });

  it('still checks an explicit region on its own span', async () => {
    expect((await repaint('long-base', { start: 10, end: 40 })).status).toBe(202);
    expect((await repaint('long-base', { start: 0, end: 100 })).status).toBe(400);
  });
});
