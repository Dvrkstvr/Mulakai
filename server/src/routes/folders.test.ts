import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-folders-test-'));

const { db } = await import('../db/index.js');
const { foldersRouter } = await import('./folders.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/folders', foldersRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/folders`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('POST /', () => {
  it('creates a folder and rejects a blank name', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Midnight Sessions' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Midnight Sessions');
    expect(body.song_count).toBe(0);

    const rejected = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  ' }),
    });
    expect(rejected.status).toBe(400);
  });
});

describe('GET / and song_count', () => {
  it('lists folders with a live count of their non-trashed songs', async () => {
    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lo-fi Beats' }),
    }).then((r) => r.json());

    db.prepare(`INSERT INTO songs (id, title, folder_id) VALUES ('song-1', 'Lo-fi Beats', ?)`).run(created.id);
    db.prepare(`INSERT INTO songs (id, title, folder_id, trashed_at) VALUES ('song-2', 'Lo-fi Beats 2', ?, datetime('now'))`).run(created.id);

    const list = await fetch(baseUrl).then((r) => r.json());
    const found = list.find((f: { id: string }) => f.id === created.id);
    expect(found.song_count).toBe(1); // trashed song excluded
  });
});

describe('PATCH /:id and DELETE /:id', () => {
  it('renames a folder and 404s for an unknown id', async () => {
    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Demo Reel' }),
    }).then((r) => r.json());

    const renamed = await fetch(`${baseUrl}/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Demo Reel v2' }),
    });
    expect(renamed.status).toBe(200);

    const missing = await fetch(`${baseUrl}/does-not-exist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(missing.status).toBe(404);
  });

  it('deletes a folder and falls its songs back to unfiled, not deleting them', async () => {
    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Throwaway' }),
    }).then((r) => r.json());
    db.prepare(`INSERT INTO songs (id, title, folder_id) VALUES ('song-3', 'Orphan', ?)`).run(created.id);

    const res = await fetch(`${baseUrl}/${created.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const song = db.prepare(`SELECT folder_id FROM songs WHERE id = 'song-3'`).get() as { folder_id: string | null };
    expect(song.folder_id).toBeNull();
  });
});

describe('GET /:id/next-title', () => {
  it('is the folder name for the first song, then increments past the highest existing suffix', async () => {
    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sunset Drive' }),
    }).then((r) => r.json());

    const first = await fetch(`${baseUrl}/${created.id}/next-title`).then((r) => r.json());
    expect(first.title).toBe('Sunset Drive');

    db.prepare(`INSERT INTO songs (id, title, folder_id) VALUES ('sd-1', 'Sunset Drive', ?)`).run(created.id);
    db.prepare(`INSERT INTO songs (id, title, folder_id) VALUES ('sd-2', 'Sunset Drive 5', ?)`).run(created.id);

    const next = await fetch(`${baseUrl}/${created.id}/next-title`).then((r) => r.json());
    expect(next.title).toBe('Sunset Drive 6'); // jumps past a gap rather than reusing 2-4

    const missing = await fetch(`${baseUrl}/does-not-exist/next-title`);
    expect(missing.status).toBe(404);
  });
});
