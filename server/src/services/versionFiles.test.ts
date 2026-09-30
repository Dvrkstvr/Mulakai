import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-versionfiles-test-'));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { versionsRouter } = await import('../routes/versions.js');
const { layersRouter } = await import('../routes/layers.js');
const { emptyTrashNow } = await import('./trashSweep.js');
const { removeVersionFiles, scoreSidecarName } = await import('./versionFiles.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/layers', layersRouter);
  app.use('/api/layers', versionsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/layers`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const exists = (file: string) => fs.existsSync(path.join(config.audioDir, file));

/** A song with a layer of `kind` holding two versions; the first has a score sidecar. */
function seed(kind: 'base' | 'vocals') {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const scored = { id: crypto.randomUUID(), audio_file: `${crypto.randomUUID()}.flac` };
  const plain = { id: crypto.randomUUID(), audio_file: `${crypto.randomUUID()}.flac` };
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Files Song')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'L', ?, 0)`).run(layerId, songId, kind);
  for (const v of [scored, plain]) {
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active) VALUES (?, ?, ?, 0)`).run(v.id, layerId, v.audio_file);
    fs.writeFileSync(path.join(config.audioDir, v.audio_file), 'audio');
  }
  fs.writeFileSync(path.join(config.audioDir, scoreSidecarName(scored.id)), 'X:1\nK:C\n');
  return { songId, layerId, scored, plain };
}

describe('version files', () => {
  it('deleting a version removes its score sidecar with its audio', async () => {
    const { scored, plain } = seed('base');
    const res = await fetch(`${baseUrl}/versions/${scored.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(exists(scored.audio_file)).toBe(false);
    expect(exists(scoreSidecarName(scored.id))).toBe(false);
    expect(exists(plain.audio_file)).toBe(true);
  });

  it('deleting a version with no sidecar is not an error', async () => {
    const { plain } = seed('base');
    const res = await fetch(`${baseUrl}/versions/${plain.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(exists(plain.audio_file)).toBe(false);
  });

  it('deleting a layer removes every version\'s files, sidecars included', async () => {
    const { layerId, scored, plain } = seed('vocals');
    const res = await fetch(`${baseUrl}/${layerId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    for (const f of [scored.audio_file, plain.audio_file, scoreSidecarName(scored.id)]) expect(exists(f)).toBe(false);
  });

  it('emptying the trash removes sidecars too', async () => {
    const { songId, scored, plain } = seed('base');
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    emptyTrashNow();
    await expect.poll(() => [scored.audio_file, plain.audio_file, scoreSidecarName(scored.id)].some(exists)).toBe(false);
  });

  it('removeVersionFiles tolerates files that are already gone', async () => {
    await expect(removeVersionFiles({ id: crypto.randomUUID(), audio_file: 'missing.flac' })).resolves.toBeUndefined();
  });
});

describe('ALT / SIMILAR routes on an extra engine\'s version', () => {
  it('answer 400 with the refusal', async () => {
    const { scored } = seed('base');
    db.prepare(`UPDATE versions SET params_json = ? WHERE id = ?`)
      .run(JSON.stringify({ prompt: 'p', engine: 'yue2', task_type: 'text2music' }), scored.id);
    for (const action of ['regenerate', 'retake']) {
      const res = await fetch(`${baseUrl}/versions/${scored.id}/${action}`, { method: 'POST' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('another engine');
    }
  });
});
