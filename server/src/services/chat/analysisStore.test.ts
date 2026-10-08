/** versions.analysis_json on a library from before C1 (Test strategy (C1) #4), the playable version, lineage
 * and the reading chain the view shows (D-120, D-179, D-180). */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA } from '../../db/schema.js';
import { CHAT_SCHEMA } from '../../db/chatSchema.js';
import type { VersionAnalysis } from './analysisTypes.js';

// A C0b library: today's tables without the analysis column, and a version on it.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-analysis-store-'));
process.env.DATA_DIR = dataDir;
const before = new Database(path.join(dataDir, 'mulakai.db'));
before.exec(SCHEMA);
before.exec(CHAT_SCHEMA);
before.prepare(`INSERT INTO songs (id, title) VALUES ('old', 'Old Song')`).run();
before.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES ('old-l', 'old', 'Base', 'base')`).run();
before.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES ('old-v', 'old-l', 'old.wav')`).run();
before.close();

const { db } = await import('../../db/index.js');
const store = await import('./analysisStore.js');

const facts = { header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 2 }, key_notes: '',
  sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 4 }, { index: 2, label: 'chorus', from_bar: 5, to_bar: 8 }], lyric_blocks: [], bar_map: [] };
const analysis = (versionId: string): VersionAnalysis => ({
  analysis_v: 1, versionId, readAt: '2026-10-07T10:00:00.000Z', plan: { words: 'skip', score: 'own', sections: 'cached' },
  words: { notRead: 'LYRICS_API_URL is not set' },
  score: { abc: 'X:1', source: 'own', chords: true, facts, warnings: [], measure: null },
  bars: { source: 'cached', offset: 0, starts: [0, 2, 4, 6, 8, 10, 12, 14], end: 16, agreement: 1 },
});

/** A song whose base layer has the given versions, in order; the last is active. */
function song(versions: Array<{ id?: string; params?: object; label?: string }>, extra = true) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'S')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  if (extra) {
    const vox = crypto.randomUUID();
    db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Vox', 'vocals', 1)`).run(vox, songId);
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active, created_at) VALUES (?, ?, 'x.wav', 1, '2027-01-01')`).run(crypto.randomUUID(), vox);
  }
  const ids = versions.map((v, i) => {
    const id = v.id ?? crypto.randomUUID();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, layer, `${id}.wav`, JSON.stringify(v.params ?? {}), i === versions.length - 1 ? 1 : 0, `2026-10-0${i + 1}`);
    return id;
  });
  return { songId, ids };
}
const scoreEdit = (basedOn: string, ops: object[], extra: object = {}) => ({ score_v: 1, engine: 'yue2', task_type: 'score', ops, basedOn, ...extra });

describe('analysis_json migration', () => {
  it('a C0b library opens with the column added; its versions read as not analyzed', () => {
    const cols = (db.prepare(`PRAGMA table_info(versions)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('analysis_json');
    expect(store.readVersionAnalysis('old-v')).toBeNull();
  });
});

describe('analysisStore', () => {
  it('writes and reads an analysis and a failed record; garbage reads as not analyzed', () => {
    const { ids: [v] } = song([{}]);
    expect(store.writeAnalysis(analysis(v))).toBe(true);
    expect(store.readVersionAnalysis(v)).toEqual(analysis(v));
    store.writeAnalysis({ analysis_v: 1, versionId: v, failed: 'the audio file is missing', at: 't' });
    expect(store.readVersionAnalysis(v)).toMatchObject({ failed: 'the audio file is missing' });
    db.prepare(`UPDATE versions SET analysis_json = '{"analysis_v": 9}' WHERE id = ?`).run(v);
    expect(store.readVersionAnalysis(v)).toBeNull();
    expect(store.writeAnalysis(analysis('gone'))).toBe(false);
  });

  it("the playable version is the base layer's active take, numbered from 1", () => {
    const { songId, ids } = song([{}, {}, {}]);
    expect(store.playableVersion(songId)).toEqual({ id: ids[2], number: 3 });
    db.prepare(`UPDATE versions SET active = CASE id WHEN ? THEN 1 ELSE 0 END WHERE id IN (?, ?, ?)`).run(ids[0], ...ids);
    expect(store.playableVersion(songId)).toEqual({ id: ids[0], number: 1 });
    expect(store.playableVersion('nope')).toBeNull();
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    expect(store.playableVersion(songId)).toBeNull();
  });

  it('lineage: basedOn when the version names it, else the take made before it on the layer', () => {
    const a = crypto.randomUUID();
    const { ids } = song([{ id: a }, { params: { task_type: 'repaint' } }, { params: scoreEdit(a, []) }]);
    expect(store.lineage(ids[2])).toMatchObject({ fromVersionId: a, from: 'basedOn' });
    expect(store.lineage(ids[1])).toMatchObject({ fromVersionId: a, from: 'previous', params: { task_type: 'repaint' } });
    expect(store.lineage(ids[0])).toMatchObject({ fromVersionId: null, from: null });
    expect(store.lineage('nope')).toBeNull();
  });

  it('word timings read loosely: absent or garbage is none', () => {
    const { ids: [v] } = song([{}]);
    expect(store.wordTimings(v)).toBeNull();
    db.prepare(`UPDATE versions SET word_timings = ? WHERE id = ?`).run(JSON.stringify({ language: 'en', segments: [] }), v);
    expect(store.wordTimings(v)).toEqual({ language: 'en', segments: [] });
    db.prepare(`UPDATE versions SET word_timings = '{x' WHERE id = ?`).run(v);
    expect(store.wordTimings(v)).toBeNull();
  });

  it('the reading chain: the latest analyzed ancestor and the bars moved since (a CUT by its section)', () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const { ids } = song([{ id: a }, { id: b, params: scoreEdit(a, [{ op: 'SET_TEMPO', bpm: 90 }]) },
      { params: scoreEdit(b, [{ op: 'CUT', section: 1, label: 'verse' }]) }]);
    store.writeAnalysis(analysis(a));
    const chain = store.readingChain(ids[2]);
    expect(chain.older).toMatchObject({ versionId: a, number: 1, words: null });
    // b was never read, so the CUT's span is unknown: moved, no shift.
    expect(chain.olderShift).toEqual({ moved: true, shift: null });
    expect(chain.parent).toEqual({ versionId: b, shift: { moved: true, shift: null } });
    store.writeAnalysis(analysis(b));
    expect(store.readingChain(ids[2])).toMatchObject({ older: { versionId: b, number: 2 }, olderShift: { moved: true, shift: { atBar: 5, delta: -4 } } });
    expect(store.readingChain(ids[1])).toMatchObject({ older: { versionId: a }, olderShift: { moved: false } });
  });

  it('a failed ancestor is skipped; a first take has no chain', () => {
    const a = crypto.randomUUID();
    const { ids } = song([{ id: a }, { params: { task_type: 'repaint', basedOn: a } }]);
    store.writeAnalysis({ analysis_v: 1, versionId: a, failed: 'x', at: 't' });
    expect(store.readingChain(ids[1])).toEqual({ older: null, olderShift: { moved: false }, parent: { versionId: a, shift: { moved: false } } });
    expect(store.readingChain(a)).toEqual({ older: null, olderShift: { moved: false }, parent: null });
  });

  // C1 code review should 1: v1 -> v2 (CUT) -> v1 made active -> repaint -> v3, which repainted v1.
  it('a repaint of an older active take: its parent is the version it names, not the newest take', () => {
    const [v1, v2] = [crypto.randomUUID(), crypto.randomUUID()];
    const { ids } = song([{ id: v1 }, { id: v2, params: scoreEdit(v1, [{ op: 'CUT', section: 1, label: 'verse' }]) },
      { params: { task_type: 'repaint', repainting_start: 2, repainting_end: 4, basedOn: v1 } }]);
    store.writeAnalysis(analysis(v1));
    store.writeAnalysis(analysis(v2));
    expect(store.readingChain(ids[2])).toMatchObject({ parent: { versionId: v1, shift: { moved: false } }, older: { versionId: v1 }, olderShift: { moved: false } });
  });

  it('a repaint that names no basedOn (made before the fix): an unknown shift from the take before it, never "not moved"', () => {
    const [v1, v2] = [crypto.randomUUID(), crypto.randomUUID()];
    const { ids } = song([{ id: v1 }, { id: v2, params: scoreEdit(v1, [{ op: 'CUT', section: 1, label: 'verse' }]) },
      { params: { task_type: 'repaint', repainting_start: 2, repainting_end: 4 } }]);
    store.writeAnalysis(analysis(v2));
    expect(store.readingChain(ids[2])).toEqual(expect.objectContaining({
      parent: { versionId: v2, shift: { moved: true, shift: null } }, olderShift: { moved: true, shift: null } }));
  });

  it('a basedOn naming a deleted version falls back to the take before it, and proves nothing', () => {
    const v1 = crypto.randomUUID();
    const { ids } = song([{ id: v1 }, { params: { task_type: 'repaint', basedOn: 'gone' } }]);
    expect(store.readingChain(ids[1]).parent).toEqual({ versionId: v1, shift: { moved: true, shift: null } });
  });

  it('a lineage loop ends instead of spinning', () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    song([{ id: a, params: scoreEdit(b, []) }, { id: b, params: scoreEdit(a, []) }]);
    expect(store.readingChain(b).older).toBeNull();
  });
});
