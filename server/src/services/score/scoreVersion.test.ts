/** F-023 #2, #4: a render saved as a new base version (sidecar first, D-038; score_v 1, D-037), and
 * a revert that brings back the previous score, style, lyrics and song meta. Temp DATA_DIR. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scoreversion-test-'));

vi.mock('../transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => { await (await import('node:fs/promises')).writeFile(outPath, master); },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

const { db } = await import('../../db/index.js');
const { config } = await import('../../config.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { loadScoreSource } = await import('./scoreSource.js');
const { persistScoreVersion, scoreEditLabel } = await import('./scoreVersion.js');
const { versionsRouter } = await import('../../routes/versions.js');
type Plan = import('./planTypes.js').Plan;

const LYRICS = '[Verse 1]\nwalking out \n\n[Chorus]\noh oh\n';
const BASE_ABC = 'X:1\nM:4/4\nL:1/8\nQ:1/4=87\nK:Dm\n"Dm"D2 F2 A2 d2 |\n';
const EDITED = 'X:1\nM:4/4\nL:1/8\nQ:1/4=88\nK:Dm\n"Dm7"D2 F2 A2 d2 |\n';
const firstTake = {
  prompt: 'dark pop', lyrics: LYRICS, engine: 'yue2', task_type: 'text2music', output: { format: 'wav' },
  request: { style: 'English, dark pop, 87 bpm', lyrics: LYRICS, seed: 831 },
};

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/layers', versionsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function seedSong() {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, lyrics, bpm, key_scale, time_signature, duration, gen_task, engine)
              VALUES (?, 'Copper Sky', ?, 87, 'D minor', '4', 183, 'text2music', 'yue2')`).run(songId, LYRICS);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, seed) VALUES (?, ?, ?, ?, '831')`)
    .run(versionId, layerId, `${versionId}.wav`, JSON.stringify(firstTake));
  await writeScoreSidecar(versionId, BASE_ABC);
  return { songId, layerId, versionId, source: (await loadScoreSource(songId))! };
}

const plan = (songId: string, baseVersionId: string): Plan => ({
  id: 'p1', songId, baseVersionId, fingerprint: 'f', request: 'jazz chords in the chorus, 88 BPM',
  ops: [{ op: 'SET_TEMPO', bpm: 88 }, { op: 'REHARMONIZE', from_bar: 17, to_bar: 24, chords: [] }],
  verdicts: [], abc: EDITED, style: 'English, dark pop, 88 bpm',
  checks: { bars: 65, seconds: 177, tokens: 1500, chordsPresent: true, changed: { abc: true, style: true } }, attempts: 1, createdAt: 0,
});
const request = { abc: EDITED, cot: 'full' as const, style: 'English, dark pop, 88 bpm', lyrics: LYRICS, seed: 831 };
const audio = Buffer.from('RIFF-fake-master');
const rows = (layerId: string) => db.prepare(`SELECT id, label, active, params_json, seed FROM versions WHERE layer_id = ? ORDER BY rowid`).all(layerId) as
  Array<{ id: string; label: string; active: number; params_json: string; seed: string }>;
const song = (id: string) => db.prepare(`SELECT bpm, key_scale, time_signature, lyrics FROM songs WHERE id = ?`).get(id);
const exists = (f: string) => fs.existsSync(path.join(config.audioDir, f));

describe('scoreEditLabel', () => {
  it('names the ops, and a truncated render says so', () => {
    expect(scoreEditLabel(plan('s', 'v').ops, false)).toBe('score edit · SET TEMPO 88 · REHARMONIZE 17–24');
    expect(scoreEditLabel([{ op: 'EDIT_STYLE', style: 'x' }], true)).toBe('score edit · EDIT STYLE (truncated)');
    const bar = [{ pitch: 'D', beats: 4 }];
    expect(scoreEditLabel([{ op: 'WRITE_PHRASE', start_bar: 57, instrument: 'tenor saxophone', bars: [bar, bar, bar, bar] }], false))
      .toBe('score edit · WRITE PHRASE tenor saxophone 57–60');
    expect(scoreEditLabel([{ op: 'TRANSPOSE', semitones: -2 }, { op: 'REPEAT', section: 3, label: 'chorus' }, { op: 'CUT', section: 4, label: 'outro' },
      { op: 'REWRITE_LYRICS', block: 5, tag: '[Chorus]', occurrence: 2, lines: ['a'] }, { op: 'TRANSPOSE', semitones: 3 }], false))
      .toBe('score edit · TRANSPOSE -2 · REPEAT chorus S3 · CUT outro S4 · REWRITE LYRICS [Chorus] #2 · TRANSPOSE +3');
  });
});

describe('persistScoreVersion', () => {
  it('writes the sidecar, then an active base version with score_v 1, and moves the song meta', async () => {
    const { songId, layerId, versionId, source } = await seedSong();
    const saved = await persistScoreVersion({ songId, plan: plan(songId, versionId), source, request, audio, score: EDITED, truncated: false });
    expect(saved).toMatchObject({ number: 2, bpm: 88, truncated: false });
    const [old, fresh] = rows(layerId);
    expect(old).toMatchObject({ id: versionId, active: 0 });
    expect(fresh).toMatchObject({ id: saved.id, active: 1, label: 'score edit · SET TEMPO 88 · REHARMONIZE 17–24', seed: '831' });
    expect(JSON.parse(fresh.params_json)).toEqual({
      score_v: 1, engine: 'yue2', task_type: 'score', output: { format: 'wav' },
      request: { style: request.style, lyrics: LYRICS, seed: 831, cot: 'full' }, lyrics: LYRICS,
      ops: plan(songId, versionId).ops, planRequest: 'jazz chords in the chorus, 88 BPM',
      meta: { bpm: 88, keyScale: 'D minor', timeSignature: '4' }, basedOn: versionId,
    });
    expect(fs.readFileSync(path.join(config.audioDir, `${saved.id}.abc`), 'utf8')).toBe(EDITED);
    expect(exists(`${saved.id}.wav`)).toBe(true);
    expect(song(songId)).toMatchObject({ bpm: 88, key_scale: 'D minor', time_signature: '4', lyrics: LYRICS });
    const now = (await loadScoreSource(songId))!;
    expect(now).toMatchObject({ activeVersionId: saved.id, abc: EDITED, style: request.style, lyrics: LYRICS, seed: 831, scoreV: 1 });
  });

  it('a failed sidecar write fails the render and leaves no version and no audio (D-038)', async () => {
    const { songId, layerId, versionId, source } = await seedSong();
    const before = fs.readdirSync(config.audioDir).length;
    await expect(persistScoreVersion(
      { songId, plan: plan(songId, versionId), source, request, audio, score: EDITED, truncated: false },
      { writeSidecar: async () => { throw new Error('EACCES: disk said no'); } },
    )).rejects.toThrow('EACCES');
    expect(rows(layerId)).toHaveLength(1);
    expect(rows(layerId)[0]).toMatchObject({ id: versionId, active: 1 });
    expect(fs.readdirSync(config.audioDir)).toHaveLength(before);
    expect(song(songId)).toMatchObject({ bpm: 87 });
  });

  it('a truncated render is saved, active and labelled, and says so in its params (F-023 #4)', async () => {
    const { songId, layerId, versionId, source } = await seedSong();
    const saved = await persistScoreVersion({ songId, plan: plan(songId, versionId), source, request, audio, score: null, truncated: true });
    expect(saved.truncated).toBe(true);
    const fresh = rows(layerId)[1];
    expect(fresh).toMatchObject({ active: 1, label: 'score edit · SET TEMPO 88 · REHARMONIZE 17–24 (truncated)' });
    expect(JSON.parse(fresh.params_json)).toMatchObject({ truncated: true });
    // No score came back: the sidecar is the score that was sent.
    expect(fs.readFileSync(path.join(config.audioDir, `${saved.id}.abc`), 'utf8')).toBe(EDITED);
  });
});

describe('revert after a score render (F-023 #2)', () => {
  const activate = (id: string) => fetch(`${base}/api/layers/versions/${id}/activate`, { method: 'PATCH' });

  it('restores the previous sidecar, style, lyrics and song meta, and forward again', async () => {
    const { songId, versionId, source } = await seedSong();
    const saved = await persistScoreVersion({ songId, plan: plan(songId, versionId), source, request, audio, score: EDITED, truncated: false });
    expect((await activate(versionId)).status).toBe(200);
    expect(await loadScoreSource(songId)).toMatchObject({
      activeVersionId: versionId, abc: BASE_ABC, style: 'English, dark pop, 87 bpm', lyrics: LYRICS, seed: 831, scoreV: 0,
    });
    expect(song(songId)).toMatchObject({ bpm: 87, key_scale: 'D minor', time_signature: '4', lyrics: LYRICS });
    expect((await activate(saved.id)).status).toBe(200);
    expect(await loadScoreSource(songId)).toMatchObject({ activeVersionId: saved.id, abc: EDITED, style: request.style, scoreV: 1 });
    expect(song(songId)).toMatchObject({ bpm: 88 });
  });

  it('stores edited lyrics (F-030, F-031) and the song follows them on save and on activate, back and forth', async () => {
    const { songId, layerId, versionId, source } = await seedSong();
    const edited = `${LYRICS}\n[Chorus]\noh oh\n`;
    const saved = await persistScoreVersion({ songId, plan: plan(songId, versionId), source, request: { ...request, lyrics: edited }, audio, score: EDITED, truncated: false });
    expect(JSON.parse(rows(layerId)[1].params_json)).toMatchObject({ request: { lyrics: edited }, lyrics: edited });
    expect(song(songId)).toMatchObject({ lyrics: edited });
    expect(await loadScoreSource(songId)).toMatchObject({ lyrics: edited });
    expect((await activate(versionId)).status).toBe(200);
    expect(song(songId)).toMatchObject({ lyrics: LYRICS });
    expect((await activate(saved.id)).status).toBe(200);
    expect(song(songId)).toMatchObject({ lyrics: edited });
  });

  it('a song that never had a score edit keeps its own meta on activate', async () => {
    const { songId, versionId } = await seedSong();
    db.prepare(`UPDATE songs SET bpm = 120 WHERE id = ?`).run(songId); // the user's own edit in the detail rail
    expect((await activate(versionId)).status).toBe(200);
    expect(song(songId)).toMatchObject({ bpm: 120 });
  });
});
