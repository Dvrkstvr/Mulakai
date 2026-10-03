import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

vi.mock('../services/fileTags.js', () => ({ retagSong: vi.fn(async () => {}) }));

const express = (await import('express')).default;
const { db } = await import('../db/index.js');
const { songsRouter } = await import('./songs.js');

const app = express();
app.use('/api/songs', songsRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

function song(id: string, title: string, trashed = false) {
  db.prepare(`INSERT INTO songs (id, title, trashed_at) VALUES (?, ?, ?)`).run(id, title, trashed ? '2026-10-01 00:00:00' : null);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(`${id}-base`, id);
}

function version(id: string, layerId: string, label: string, createdAt: string, active = 1) {
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, layerId, `${id}.wav`, label, active, createdAt);
}

beforeAll(async () => {
  song('old', 'Old Song');
  version('old-v1', 'old-base', 'first generation', '2026-10-01 08:00:00');

  // Created first, but edited last: a repaint on a vocals lane.
  song('copper', 'Copper Sky');
  version('copper-v1', 'copper-base', 'first generation', '2026-10-01 07:00:00');
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES ('copper-vox', 'copper', 'Vocals', 'vocals', 1)`).run();
  version('copper-vox-v1', 'copper-vox', 'add layer', '2026-10-02 09:00:00', 0);
  version('copper-vox-v2', 'copper-vox', 'repaint 1:32–2:07', '2026-10-03 10:00:00');

  song('mid', 'Mid Song');
  version('mid-v1', 'mid-base', 'first generation', '2026-10-02 12:00:00');

  song('gone', 'Trashed Song', true);
  version('gone-v1', 'gone-base', 'first generation', '2026-10-03 23:00:00');

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}/api/songs`;
      resolve();
    });
  });
});

afterAll(() => server.close());

const recent = async (query = '') => {
  const res = await fetch(`${baseUrl}/recent${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Array<Record<string, unknown>>;
};

describe('GET /recent', () => {
  it('orders songs by their newest version and leaves trashed songs out', async () => {
    expect((await recent('?limit=10')).map((r) => r.id)).toEqual(['copper', 'mid', 'old']);
  });

  it("names the newest version's layer, label and time, the layer's take count and the base audio", async () => {
    const [copper] = await recent();
    expect(copper).toMatchObject({
      title: 'Copper Sky', layer_name: 'Vocals', layer_kind: 'vocals', version_label: 'repaint 1:32–2:07',
      edited_at: '2026-10-03 10:00:00', layer_versions: 2, audio_file: 'copper-v1.wav',
    });
  });

  it('defaults to 3 and clamps the limit', async () => {
    song('extra', 'Extra Song');
    version('extra-v1', 'extra-base', 'first generation', '2026-09-30 00:00:00');
    expect(await recent()).toHaveLength(3);
    expect(await recent('?limit=1')).toHaveLength(1);
    expect(await recent('?limit=0')).toHaveLength(1);
    expect(await recent('?limit=nope')).toHaveLength(3);
  });

  it('is not taken for a song id by GET /:id', async () => {
    const res = await fetch(`${baseUrl}/recent`);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
