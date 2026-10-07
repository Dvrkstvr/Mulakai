/** An analyze card's target: the READ card's estimate plan (readingPlan, D-148 d) and the copy made at READ. */
import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-read-target-'));

const { config } = await import('../../config.js');
const { db } = await import('../../db/index.js');
const { draftThread, resetDraftThread } = await import('./threadStore.js');
const store = await import('./referenceStore.js');
const { materialise, planFor, referenceView } = await import('./readTarget.js');

afterEach(() => { resetDraftThread(); });

function wav(): Buffer {
  const data = Buffer.alloc(16000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const ALL = { lyrics: true, yue: true, acestep: true };

function song(engine: string | null, lyrics = '', caption = ''): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, engine, lyrics, caption) VALUES (?, 'Lied', ?, ?, ?)`).run(id, engine, lyrics, caption);
  return id;
}

describe('planFor (the READ card estimate, D-148 d)', () => {
  it('an upload runs every step on its service; an unset service skips', () => {
    const t = draftThread();
    const added = store.fromUpload(t.id, { data: wav(), filename: 'a.wav' });
    if (!added.ok) throw new Error(added.reason);
    expect(planFor({ referenceId: added.reference.id }, ALL)).toEqual({ words: 'service', score: 'service', caption: 'service' });
    expect(planFor({ referenceId: added.reference.id }, { ...ALL, lyrics: false })).toMatchObject({ words: 'skip' });
  });

  it('a library song named in words: its own words and caption; a YuE2 song its own score too', () => {
    expect(planFor({ songId: song('yue2', 'la la', 'pop') }, ALL)).toEqual({ words: 'own', score: 'own', caption: 'own' });
    expect(planFor({ songId: song('acestep') }, ALL)).toEqual({ words: 'service', score: 'service', caption: 'service' });
  });
});

describe('materialise (READ makes the copy)', () => {
  it('an attached reference of this thread is used as is; another thread\'s is refused', async () => {
    const t = draftThread();
    const added = store.fromUpload(t.id, { data: wav(), filename: 'b.wav' });
    if (!added.ok) throw new Error(added.reason);
    expect(await materialise(t.id, { referenceId: added.reference.id })).toMatchObject({ reference: { id: added.reference.id } });
    expect(await materialise('other', { referenceId: added.reference.id })).toEqual({ reason: 'this reference is no longer attached: attach it again' });
  });

  it('a library song is copied now; one that is gone says so', async () => {
    const t = draftThread();
    const id = song('yue2');
    const layer = crypto.randomUUID();
    const version = crypto.randomUUID();
    db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', 'base')`).run(layer, id);
    fs.mkdirSync(config.audioDir, { recursive: true });
    fs.writeFileSync(path.join(config.audioDir, `${version}.wav`), wav());
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, active) VALUES (?, ?, ?, 'first', 1)`).run(version, layer, `${version}.wav`);
    const out = await materialise(t.id, { songId: id });
    expect(out).toMatchObject({ reference: { origin: 'library', sourceSongId: id, threadId: t.id } });
    expect(await materialise(t.id, { songId: 'nope' })).toEqual({ reason: 'that song is not in the library' });
  });
});

describe('referenceView (RE-ANALYZE prices its reading like READ, C3 live B)', () => {
  it('an upload reads on the GPU; a YuE2 library song with its own words and caption reads with none', async () => {
    const t = draftThread();
    const added = store.fromUpload(t.id, { data: wav(), filename: 'c.wav' });
    if (!added.ok) throw new Error(added.reason);
    expect(referenceView(added.reference, ALL).estimate.total).toBeGreaterThan(0);
    const own = { own_v: 1 as const, abc: 'X:1', lyrics: 'la la', caption: 'pop', bpm: 70, key: 'Am', meter: '4/4', engine: 'yue2', layers: 1 };
    const library = { ...added.reference, origin: 'library' as const, own };
    expect(referenceView(library, ALL)).toMatchObject({ origin: 'library', estimate: { total: 0 } });
  });
});
