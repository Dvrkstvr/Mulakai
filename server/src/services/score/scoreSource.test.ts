import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scoresource-test-'));

const { db } = await import('../../db/index.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { loadScoreSource } = await import('./scoreSource.js');

const firstTakeParams = {
  prompt: 'pop', lyrics: '[Verse]\nwalking out\n', engine: 'yue2', task_type: 'text2music',
  request: { style: 'English, pop, 87 bpm', lyrics: '[Verse]\nwalking out\n', seed: 831 },
};

function seedSong(opts: { engine?: string | null; genTask?: string; sidecar?: string | null } = {}) {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, gen_task, engine) VALUES (?, 'S', ?, ?)`)
    .run(songId, opts.genTask ?? 'text2music', opts.engine === undefined ? 'yue2' : opts.engine);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed) VALUES (?, ?, ?, ?, '831')`)
    .run(versionId, layerId, `${versionId}.flac`, JSON.stringify(firstTakeParams));
  return { songId, layerId, versionId };
}

function addVersion(layerId: string, params: object, activate = true): string {
  const id = crypto.randomUUID();
  if (activate) db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active) VALUES (?, ?, ?, ?, ?)`)
    .run(id, layerId, `${id}.flac`, JSON.stringify(params), activate ? 1 : 0);
  return id;
}

describe('loadScoreSource', () => {
  it('reads a YuE2 first take: row facts, versions, sidecar and the request (shape 0, no score_v)', async () => {
    const { songId, layerId, versionId } = seedSong();
    await writeScoreSidecar(versionId, 'X:1\nK:Dm\n');
    const s = await loadScoreSource(songId);
    expect(s).toMatchObject({
      songId, engine: 'yue2', genTask: 'text2music', layerCount: 1, baseLayerId: layerId,
      activeVersionId: versionId, abc: 'X:1\nK:Dm\n', style: 'English, pop, 87 bpm',
      lyrics: '[Verse]\nwalking out\n', seed: 831, scoreV: 0,
    });
    expect(s!.baseVersions).toEqual([{ id: versionId, engine: 'yue2', taskType: 'text2music', scoreV: 0 }]);
  });

  it('a missing sidecar reads as abc null', async () => {
    const { songId } = seedSong();
    expect((await loadScoreSource(songId))!.abc).toBeNull();
  });

  it('a repaint version carries no engine (D-043)', async () => {
    const { songId, layerId } = seedSong();
    const repaint = addVersion(layerId, { task_type: 'repaint', lyrics: 'x' });
    const s = await loadScoreSource(songId);
    expect(s!.baseVersions.find((v) => v.id === repaint)).toEqual({ id: repaint, engine: null, taskType: 'repaint', scoreV: 0 });
    expect(s!.activeVersionId).toBe(repaint);
  });

  it('reads style, lyrics, seed and score from the ACTIVE score version (score_v 1)', async () => {
    const { songId, layerId } = seedSong();
    const v2 = addVersion(layerId, {
      score_v: 1, engine: 'yue2', task_type: 'score',
      request: { style: 'English, pop, 88 bpm', lyrics: '[Verse]\nwalking out\n', seed: 831, cot: 'full' },
    });
    await writeScoreSidecar(v2, 'X:1\nQ:1/4=88\n');
    const s = await loadScoreSource(songId);
    expect(s).toMatchObject({ activeVersionId: v2, style: 'English, pop, 88 bpm', abc: 'X:1\nQ:1/4=88\n', scoreV: 1 });
  });

  it('counts every layer of the song', async () => {
    const { songId } = seedSong();
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Vocals', 'vocals', 1)`)
      .run(crypto.randomUUID(), songId);
    expect((await loadScoreSource(songId))!.layerCount).toBe(2);
  });

  it('the fingerprint changes when a version lands, a layer is added or the active version moves', async () => {
    const { songId, layerId, versionId } = seedSong();
    const fp0 = (await loadScoreSource(songId))!.fingerprint;
    expect((await loadScoreSource(songId))!.fingerprint).toBe(fp0);
    const v2 = addVersion(layerId, { task_type: 'repaint' }, false);
    const fp1 = (await loadScoreSource(songId))!.fingerprint;
    expect(fp1).not.toBe(fp0);
    db.prepare(`UPDATE versions SET active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE layer_id = ?`).run(v2, layerId);
    const fp2 = (await loadScoreSource(songId))!.fingerprint;
    expect(fp2).not.toBe(fp1);
    db.prepare(`UPDATE versions SET active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE layer_id = ?`).run(versionId, layerId);
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Drums', 'drums', 1)`)
      .run(crypto.randomUUID(), songId);
    expect((await loadScoreSource(songId))!.fingerprint).not.toBe(fp1);
  });

  it('a missing or trashed song is null', async () => {
    expect(await loadScoreSource('nope')).toBeNull();
    const { songId } = seedSong();
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    expect(await loadScoreSource(songId)).toBeNull();
  });

  it('an ACE-Step song is read too (eligibility hides it, not the resolver)', async () => {
    const { songId } = seedSong({ engine: null });
    expect((await loadScoreSource(songId))!.engine).toBeNull();
  });
});
