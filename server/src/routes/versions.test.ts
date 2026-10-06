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
const { config } = await import('../config.js');
const { writeScoreSidecar } = await import('../services/versionFiles.js');

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

/** A 2-second silent mono 16-bit 8 kHz WAV, so the first take's length can be read back. */
function silentWav(seconds: number): Buffer {
  const data = 8000 * 2 * seconds;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data, 40);
  return b;
}

describe('DELETE /versions/:versionId', () => {
  it('deleting the active score version restores the song meta of the version it falls back to (D-053 e)', async () => {
    const songId = crypto.randomUUID();
    const layerId = crypto.randomUUID();
    const v1 = crypto.randomUUID();
    const v2 = crypto.randomUUID();
    // The song's meta currently follows v2, an 88 BPM score render of a 120 BPM YuE2 first take.
    db.prepare(`INSERT INTO songs (id, title, bpm, key_scale, time_signature, duration) VALUES (?, 'Copper Sky', 88, 'D minor', '4', 184)`)
      .run(songId);
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed, active, created_at)
                VALUES (?, ?, ?, ?, '831', 0, '2026-10-01 10:00:00')`)
      .run(v1, layerId, `${v1}.wav`, JSON.stringify({ engine: 'yue2', task_type: 'text2music', lyrics: 'la' }));
    fs.writeFileSync(path.join(config.audioDir, `${v1}.wav`), silentWav(2));
    await writeScoreSidecar(v1, 'X:1\nM:3/4\nL:1/8\nQ:1/4=120\nK:Am\nA2 c2 e2 |\n');
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed, active, created_at)
                VALUES (?, ?, ?, ?, '831', 1, '2026-10-02 10:00:00')`)
      .run(v2, layerId, `${v2}.wav`, JSON.stringify({
        score_v: 1, engine: 'yue2', task_type: 'score', lyrics: 'la',
        meta: { bpm: 88, keyScale: 'D minor', timeSignature: '4', duration: 184 }, basedOn: v1,
      }));

    const res = await fetch(`${baseUrl}/versions/${v2}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    expect(db.prepare(`SELECT active FROM versions WHERE id = ?`).get(v1)).toEqual({ active: 1 });
    expect(db.prepare(`SELECT bpm, key_scale, time_signature, duration FROM songs WHERE id = ?`).get(songId))
      .toEqual({ bpm: 120, key_scale: 'A minor', time_signature: '3', duration: 2 });
  });
});
