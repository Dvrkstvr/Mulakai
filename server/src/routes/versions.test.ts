import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-versions-test-'));

const { db } = await import('../db/index.js');
const { versionsRouter } = await import('./versions.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/layers', versionsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/layers`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Seed a base layer with two versions, each carrying its own `lyrics` in params_json (as a real generation/repaint would). */
function seedBaseLayerVersions(): { songId: string; olderVersionId: string; newerVersionId: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const olderVersionId = crypto.randomUUID();
  const newerVersionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, lyrics) VALUES (?, ?, ?)`).run(songId, 'Test Song', '[Verse]\nnewer words');
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active)
     VALUES (?, ?, 'older.mp3', 'first generation', ?, 's1', 0)`,
  ).run(olderVersionId, layerId, JSON.stringify({ task_type: 'text2music', lyrics: '[Verse]\nolder words' }));
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active)
     VALUES (?, ?, 'newer.mp3', 'repaint', ?, 's2', 1)`,
  ).run(newerVersionId, layerId, JSON.stringify({ task_type: 'repaint', lyrics: '[Verse]\nnewer words' }));
  return { songId, olderVersionId, newerVersionId };
}

describe('PATCH /versions/:versionId/activate', () => {
  it('makes the target version active and deactivates its sibling', async () => {
    const { olderVersionId, newerVersionId } = seedBaseLayerVersions();

    const res = await fetch(`${baseUrl}/versions/${olderVersionId}/activate`, { method: 'PATCH' });
    expect(res.status).toBe(200);

    const older = db.prepare(`SELECT active FROM versions WHERE id = ?`).get(olderVersionId) as { active: number };
    const newer = db.prepare(`SELECT active FROM versions WHERE id = ?`).get(newerVersionId) as { active: number };
    expect(older.active).toBe(1);
    expect(newer.active).toBe(0);
  });

  it('restores songs.lyrics to the reverted base-layer version\'s own stored lyrics', async () => {
    const { songId, olderVersionId } = seedBaseLayerVersions();

    await fetch(`${baseUrl}/versions/${olderVersionId}/activate`, { method: 'PATCH' });

    const song = db.prepare(`SELECT lyrics FROM songs WHERE id = ?`).get(songId) as { lyrics: string };
    expect(song.lyrics).toBe('[Verse]\nolder words');
  });

  it('returns 404 for an unknown version', async () => {
    const res = await fetch(`${baseUrl}/versions/${crypto.randomUUID()}/activate`, { method: 'PATCH' });
    expect(res.status).toBe(404);
  });
});
