import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

// retagSong opens the song's audio with taglib — irrelevant here and the fixture rows
// have no real audio behind them.
vi.mock('../services/fileTags.js', () => ({ retagSong: vi.fn(async () => {}) }));

const express = (await import('express')).default;
const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { songsRouter } = await import('./songs.js');

const app = express();
app.use(express.json());
app.use('/api/songs', songsRouter);

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  db.prepare(`INSERT INTO songs (id, title) VALUES ('s1', 'Test Song')`).run();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}/api/songs`;
      resolve();
    });
  });
});

afterAll(() => server.close());

function postCoverArt(filename: string, content = 'image bytes') {
  const form = new FormData();
  form.append('image', new Blob([content]), filename);
  return fetch(`${baseUrl}/s1/cover-art`, { method: 'POST', body: form });
}

describe('POST /:id/cover-art', () => {
  it('stores an allowlisted image and records it on the song', async () => {
    const res = await postCoverArt('art.PNG');
    expect(res.status).toBe(200);
    const { coverArtFile } = await res.json();
    expect(coverArtFile).toBe('s1-cover.png');
    expect(fs.existsSync(path.join(config.audioDir, coverArtFile))).toBe(true);
  });

  it('rejects a non-image extension that would be served same-origin', async () => {
    const res = await postCoverArt('evil.html', '<script>alert(1)</script>');
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatch(/unsupported image format/);
    expect(fs.existsSync(path.join(config.audioDir, 's1-cover.html'))).toBe(false);
  });

  it('rejects .svg specifically (scriptable image format)', async () => {
    const res = await postCoverArt('art.svg', '<svg onload="alert(1)"/>');
    expect(res.status).toBe(400);
  });
});

describe('GET /:id engine fields', () => {
  it('carries songs.engine and each version\'s engine (null for ACE-Step)', async () => {
    db.prepare(`INSERT INTO songs (id, title, engine) VALUES ('s-engine', 'Engine Song', 'yue2')`).run();
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES ('l-engine', 's-engine', 'Base', 'base', 0)`).run();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, created_at) VALUES (?, 'l-engine', 'a.flac', ?, '2026-09-30 10:00:00')`)
      .run('v-engine', JSON.stringify({ prompt: 'p', engine: 'yue2', task_type: 'text2music' }));
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, created_at) VALUES (?, 'l-engine', 'b.flac', ?, '2026-09-30 11:00:00')`)
      .run('v-repaint', JSON.stringify({ prompt: 'p', task_type: 'repaint' }));

    const song = await (await fetch(`${baseUrl}/s-engine`)).json();
    expect(song.engine).toBe('yue2');
    expect(song.layers[0].versions.map((v: { id: string; engine: string | null }) => [v.id, v.engine])).toEqual([
      ['v-repaint', null],
      ['v-engine', 'yue2'],
    ]);
  });
});
