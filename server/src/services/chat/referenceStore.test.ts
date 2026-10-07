/** References on a temp DATA_DIR: upload and library copies, the reading, the orphan sweep (F-061 storage, F-062, D-127, D-137). */
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-reference-store-'));

const { config } = await import('../../config.js');
const { db } = await import('../../db/index.js');
const { draftThread, resetDraftThread } = await import('./threadStore.js');
const store = await import('./referenceStore.js');
type Reading = import('./reading.js').Reading;

/** `seconds` of 8 kHz mono 16-bit silence: a real WAV the probe can read. */
function wav(seconds = 1): Buffer {
  const data = Buffer.alloc(16000 * seconds);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const refDir = () => path.join(config.audioDir, 'references');
const refFiles = () => (fs.existsSync(refDir()) ? fs.readdirSync(refDir()).sort() : []);

/** A library song: base layer with an older and an active take (+ a score sidecar), and a vocals layer. */
function librarySong(over: { engine?: string | null; layers?: number } = {}) {
  const songId = crypto.randomUUID();
  const base = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration, engine) VALUES (?, 'Kopf Hoch', 'dark synthpop', '[Verse]\nHey du', 96, 'A minor', '4', 2, ?)`)
    .run(songId, over.engine === undefined ? 'yue2' : over.engine);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(base, songId);
  if ((over.layers ?? 2) > 1) db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Vox', 'vocals', 1)`).run(crypto.randomUUID(), songId);
  const old = crypto.randomUUID();
  const active = crypto.randomUUID();
  fs.writeFileSync(path.join(config.audioDir, `${old}.wav`), wav(1));
  fs.writeFileSync(path.join(config.audioDir, `${active}.wav`), wav(2));
  fs.writeFileSync(path.join(config.audioDir, `${active}.abc`), 'X:1\nK:Am\n% verse\n');
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active, params_json, created_at) VALUES (?, ?, ?, 0, '{}', '2026-01-01')`).run(old, base, `${old}.wav`);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active, params_json, created_at) VALUES (?, ?, ?, 1, ?, '2026-01-02')`)
    .run(active, base, `${active}.wav`, JSON.stringify({ engine: 'yue2', request: { lyrics: '[verse]\nHey du, was ist los' } }));
  return { songId, active };
}

beforeEach(() => { resetDraftThread(); });

describe('fromUpload', () => {
  it('copies a readable audio file to references/<id>.<ext> with its length, bytes and hash', () => {
    const thread = draftThread();
    const data = wav(3);
    const res = store.fromUpload(thread.id, { data, filename: 'My Take.WAV' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ref = res.reference;
    expect(ref).toMatchObject({ threadId: thread.id, origin: 'upload', name: 'My Take.WAV', sourceSongId: null, file: `references/${ref.id}.wav`, bytes: data.length, own: null, reading: null });
    expect(ref.seconds).toBeCloseTo(3, 1);
    expect(ref.sha256).toBe(crypto.createHash('sha256').update(data).digest('hex'));
    expect(fs.readFileSync(path.join(config.audioDir, ref.file))).toEqual(data);
    expect(store.listReferences(thread.id).map((r) => r.id)).toEqual([ref.id]);
  });

  it('the same file twice in a thread is the same reference', () => {
    const thread = draftThread();
    const a = store.fromUpload(thread.id, { data: wav(1), filename: 'a.wav' });
    const b = store.fromUpload(thread.id, { data: wav(1), filename: 'again.wav' });
    expect(a.ok && b.ok && b.reference.id === a.reference.id && b.existing).toBe(true);
    expect(store.listReferences(thread.id)).toHaveLength(1);
  });

  it('a non-audio or unreadable file is refused with the reason and nothing is stored', () => {
    const thread = draftThread();
    const before = refFiles();
    expect(store.fromUpload(thread.id, { data: Buffer.from('hello'), filename: 'notes.txt' })).toEqual({ ok: false, reason: expect.stringContaining('not an audio file') });
    expect(store.fromUpload(thread.id, { data: Buffer.from('not really audio'), filename: 'fake.mp3' })).toEqual({ ok: false, reason: expect.stringContaining('could not be read as audio') });
    expect(refFiles()).toEqual(before);
    expect(store.listReferences(thread.id)).toEqual([]);
  });
});

describe('fromLibrary (D-137)', () => {
  it("copies the base layer's active take and snapshots the song's own data (own_v 1)", async () => {
    const thread = draftThread();
    const { songId, active } = librarySong();
    const res = await store.fromLibrary(thread.id, songId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ref = res.reference;
    expect(ref).toMatchObject({ origin: 'library', name: 'Kopf Hoch', sourceSongId: songId, file: `references/${ref.id}.wav` });
    expect(fs.readFileSync(path.join(config.audioDir, ref.file))).toEqual(fs.readFileSync(path.join(config.audioDir, `${active}.wav`)));
    expect(ref.seconds).toBeCloseTo(2, 1);
    expect(ref.own).toEqual({
      own_v: 1, abc: 'X:1\nK:Am\n% verse\n', lyrics: '[verse]\nHey du, was ist los', caption: 'dark synthpop',
      bpm: 96, key: 'A minor', meter: '4', engine: 'yue2', layers: 2,
    });
    expect(store.toView(ref)).toMatchObject({ url: `/audio/references/${ref.id}.wav`, layers: 2, readTo: ref.seconds, cut: false, readAt: null });
  });

  it('the copy outlives the library song', async () => {
    const thread = draftThread();
    const { songId } = librarySong({ engine: null, layers: 1 });
    const res = await store.fromLibrary(thread.id, songId);
    if (!res.ok) throw new Error(res.reason);
    expect(res.reference.own).toMatchObject({ abc: 'X:1\nK:Am\n% verse\n', engine: null, layers: 1 });
    db.prepare(`DELETE FROM songs WHERE id = ?`).run(songId);
    const ref = store.getReference(res.reference.id)!;
    expect(ref.sourceSongId).toBeNull();
    expect(fs.existsSync(path.join(config.audioDir, ref.file))).toBe(true);
  });

  it('refuses a missing or trashed song, or one without a take', async () => {
    const thread = draftThread();
    expect(await store.fromLibrary(thread.id, 'nope')).toEqual({ ok: false, reason: 'that song is not in the library' });
    const { songId } = librarySong();
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    expect(await store.fromLibrary(thread.id, songId)).toEqual({ ok: false, reason: 'that song is not in the library' });
    const bare = crypto.randomUUID();
    db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Empty')`).run(bare);
    expect(await store.fromLibrary(thread.id, bare)).toEqual({ ok: false, reason: 'Empty has no take to read' });
  });
});

describe('the reading on the row', () => {
  const reading: Reading = {
    reading_v: 1, readAt: '2026-10-07T10:00:00Z', seconds: 1, readTo: 1, cut: false,
    plan: { words: 'skip', score: 'skip', caption: 'skip' },
    words: { notRead: 'LYRICS_API_URL is not set' }, score: { notRead: 'x' }, caption: { notRead: 'ACE-Step is not running' },
  };

  it('setReading stores the latest; the view says when it was read', () => {
    const thread = draftThread();
    const res = store.fromUpload(thread.id, { data: wav(1), filename: 'r.wav' });
    if (!res.ok) throw new Error(res.reason);
    expect(store.setReading(res.reference.id, reading)).toBe(true);
    const ref = store.getReference(res.reference.id)!;
    expect(ref.reading).toEqual(reading);
    expect(store.toView(ref).readAt).toBe(reading.readAt);
    expect(store.setReading('gone', reading)).toBe(false);
  });

  it('an unreadable stored reading reads as none with a note', () => {
    const thread = draftThread();
    const res = store.fromUpload(thread.id, { data: wav(2), filename: 'r2.wav' });
    if (!res.ok) throw new Error(res.reason);
    db.prepare(`UPDATE chat_references SET reading_json = '{"reading_v":9}' WHERE id = ?`).run(res.reference.id);
    const ref = store.getReference(res.reference.id)!;
    expect(ref.reading).toBeNull();
    expect(store.toView(ref).readingNote).toContain('read again');
  });
});

describe('sweepFiles (orphans only)', () => {
  it('removes files without a row, keeps the rest; NEW CHAT orphans the draft thread\'s files', async () => {
    await store.sweepFiles(); // the earlier tests' reset threads
    const thread = draftThread();
    const kept = store.fromUpload(thread.id, { data: wav(1), filename: 'keep.wav' });
    if (!kept.ok) throw new Error(kept.reason);
    fs.writeFileSync(path.join(refDir(), 'stray.mp3'), 'x');
    expect(await store.sweepFiles()).toBe(1);
    expect(refFiles()).toContain(`${kept.reference.id}.wav`);
    expect(refFiles()).not.toContain('stray.mp3');
    resetDraftThread();
    expect(store.getReference(kept.reference.id)).toBeNull();
    await store.sweepFiles();
    expect(refFiles()).not.toContain(`${kept.reference.id}.wav`);
  });

  it('no references folder yet: nothing to do', async () => {
    fs.rmSync(refDir(), { recursive: true, force: true });
    expect(await store.sweepFiles()).toBe(0);
  });
});
