/** The kept notation files of a transcription (re-time, D-207). */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-notation-test-'));
process.env.DATA_DIR = DATA;

const { db } = await import('../db/index.js');
const { loadNotation, notationId, referencedNotationIds, saveNotation, sweepNotation, NOTATION_MAX_AGE_MS } =
  await import('./notationStore.js');

const bundle = (beats = 'MC4wCTEJNAk0Cg==') => ({
  files: { 'song_melody.mid': 'TVRoZA==', 'song_beats.txt': beats, 'song_chords.txt': '', 'song_keys.txt': '', 'song_structures.txt': '' },
  chords: false,
});
const file = (id: string) => path.join(DATA, 'notation', `${id}.json`);
const age = (id: string, ms: number) => { const t = new Date(Date.now() - ms); fs.utimesSync(file(id), t, t); };

describe('saveNotation / loadNotation', () => {
  it('keeps a bundle under its content hash and reads it back', async () => {
    const id = await saveNotation(bundle());
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await loadNotation(id)).toEqual(bundle());
    expect(await saveNotation(bundle())).toBe(id); // the same source shares one file
    expect(notationId(bundle('MS4wCTEJNAk0Cg=='))).not.toBe(id);
    expect(notationId({ ...bundle(), chords: true })).not.toBe(id);
  });

  it('saving again restarts an existing copy\'s age', async () => {
    const id = await saveNotation(bundle('Zm9v'));
    age(id, NOTATION_MAX_AGE_MS + 1000);
    await saveNotation(bundle('Zm9v'));
    expect(Date.now() - fs.statSync(file(id)).mtimeMs).toBeLessThan(60_000);
  });

  it('is "no saved reading" for an unknown, malformed or garbled id, never a crash', async () => {
    expect(await loadNotation('0'.repeat(64))).toBeNull();
    expect(await loadNotation('../mulakai')).toBeNull();
    const id = 'a'.repeat(64);
    fs.writeFileSync(file(id), '{not json');
    expect(await loadNotation(id)).toBeNull();
    fs.writeFileSync(file(id), JSON.stringify({ notation_v: 2, files: {} }));
    expect(await loadNotation(id)).toBeNull();
  });
});

describe('referencedNotationIds / sweepNotation', () => {
  it('finds ids in version params, version analyses and chat reference readings', () => {
    const [p, a, r] = ['1', '2', '3'].map((c) => c.repeat(64));
    db.prepare(`INSERT INTO songs (id, title) VALUES ('ns', 'S')`).run();
    db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES ('ns-l', 'ns', 'Base', 'base')`).run();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, analysis_json) VALUES ('ns-v', 'ns-l', 'a.wav', ?, ?)`)
      .run(JSON.stringify({ abc: 'X:1', notationId: p }), JSON.stringify({ score: { abc: 'X:1', notationId: a } }));
    db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES ('ns-t', 'ns')`).run();
    db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, file, bytes, sha256, reading_json)
                VALUES ('ns-r', 'ns-t', 'upload', 'x.mp3', 'references/x.mp3', 1, 'h', ?)`)
      .run(JSON.stringify({ reading_v: 1, score: { notationId: r } }));
    expect(referencedNotationIds()).toEqual(new Set([p, a, r]));
  });

  it('deletes only old bundles that nothing points at', async () => {
    const [kept, young, old] = await Promise.all(['a2VwdA==', 'eW91bmc=', 'b2xk'].map((b) => saveNotation(bundle(b))));
    for (const id of [kept, old]) age(id, NOTATION_MAX_AGE_MS + 1000);
    age(young, NOTATION_MAX_AGE_MS - 60_000);
    fs.writeFileSync(path.join(DATA, 'notation', 'stray.txt'), 'not ours');
    expect(await sweepNotation(new Set([kept]))).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(file(kept)) && fs.existsSync(file(young))).toBe(true);
    expect(fs.existsSync(file(old))).toBe(false);
    expect(fs.existsSync(path.join(DATA, 'notation', 'stray.txt'))).toBe(true);
  });
});
