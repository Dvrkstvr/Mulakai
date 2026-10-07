/** The chat tables on an existing library (F-041 #1) and their lifecycle (D-102, docs/decisions/0007). */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA } from './schema.js';

// A library from before the chat: today's schema and a song, no chat tables.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-schema-'));
process.env.DATA_DIR = dataDir;
const before = new Database(path.join(dataDir, 'mulakai.db'));
before.exec(SCHEMA);
before.prepare(`INSERT INTO songs (id, title, lyrics) VALUES ('old', 'Old Song', '[Verse]\nla')`).run();
before.prepare(`INSERT INTO layers (id, song_id, name) VALUES ('old-l', 'old', 'base')`).run();
before.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES ('old-v', 'old-l', 'old.wav')`).run();
const songsBefore = before.prepare(`SELECT * FROM songs`).all();
before.close();

const { db } = await import('./index.js');

const tables = () => (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'chat_%' ORDER BY name`).all() as { name: string }[]).map((r) => r.name);
const count = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

function seedThread(id: string, songId: string | null, versionId: string | null = null) {
  db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES (?, ?)`).run(id, songId);
  db.prepare(`INSERT INTO chat_messages (id, thread_id, seq, role, kind, version_id) VALUES (?, ?, 1, 'assistant', 'song', ?)`)
    .run(`${id}-m`, id, versionId);
}

describe('chat schema migration', () => {
  it('a pre-chat library opens with the chat tables added and its songs untouched', () => {
    expect(tables()).toEqual(['chat_messages', 'chat_references', 'chat_threads']);
    // Every column the song had is unchanged (index.ts's older ensureColumn migrations may add more).
    const songsAfter = db.prepare(`SELECT * FROM songs`).all() as object[];
    expect(songsAfter).toHaveLength(songsBefore.length);
    songsBefore.forEach((row, i) => expect(songsAfter[i]).toMatchObject(row as object));
    expect(count(`SELECT COUNT(*) AS n FROM versions WHERE id = 'old-v'`)).toBe(1);
  });

  it('runs again on the next start without error (IF NOT EXISTS)', async () => {
    const { CHAT_SCHEMA } = await import('./chatSchema.js');
    expect(() => db.exec(CHAT_SCHEMA)).not.toThrow();
  });
});

describe('chat lifecycle follows the song (D-102)', () => {
  it('trashing a song keeps its thread and messages', () => {
    seedThread('t-old', 'old', 'old-v');
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = 'old'`).run();
    expect(count(`SELECT COUNT(*) AS n FROM chat_messages WHERE thread_id = 't-old'`)).toBe(1);
    db.prepare(`UPDATE songs SET trashed_at = NULL WHERE id = 'old'`).run();
    expect(count(`SELECT COUNT(*) AS n FROM chat_threads WHERE song_id = 'old'`)).toBe(1);
  });

  it('a deleted version leaves its card with version_id NULL', () => {
    db.prepare(`DELETE FROM versions WHERE id = 'old-v'`).run();
    expect(db.prepare(`SELECT version_id FROM chat_messages WHERE id = 't-old-m'`).get()).toEqual({ version_id: null });
  });

  it('permanently deleting the song deletes its thread and messages (cascade)', () => {
    db.prepare(`DELETE FROM songs WHERE id = 'old'`).run();
    expect(count(`SELECT COUNT(*) AS n FROM chat_threads WHERE id = 't-old'`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM chat_messages WHERE thread_id = 't-old'`)).toBe(0);
  });

  it('references go with their thread (cascade); a library pick may outlive its source song (SET NULL)', () => {
    db.prepare(`INSERT INTO songs (id, title) VALUES ('src', 'Source'), ('owner', 'Owner')`).run();
    seedThread('t-ref', 'owner');
    const ref = db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, source_song_id, file, bytes, sha256) VALUES (?, 't-ref', ?, ?, ?, ?, 1, 'h')`);
    ref.run('r1', 'library', 'Source', 'src', 'references/r1.wav');
    ref.run('r2', 'upload', 'a.mp3', null, 'references/r2.mp3');
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = 'owner'`).run();
    expect(count(`SELECT COUNT(*) AS n FROM chat_references WHERE thread_id = 't-ref'`)).toBe(2); // trash keeps them
    db.prepare(`DELETE FROM songs WHERE id = 'src'`).run();
    expect(db.prepare(`SELECT source_song_id FROM chat_references WHERE id = 'r1'`).get()).toEqual({ source_song_id: null });
    db.prepare(`DELETE FROM songs WHERE id = 'owner'`).run(); // permanent delete -> thread -> references
    expect(count(`SELECT COUNT(*) AS n FROM chat_references WHERE thread_id = 't-ref'`)).toBe(0);
  });

  it('there is at most one draft thread (song_id NULL)', () => {
    seedThread('d1', null);
    expect(() => seedThread('d2', null)).toThrow(/UNIQUE/);
  });

  it('a song has at most one thread, and seq and client_key are unique per thread', () => {
    db.prepare(`INSERT INTO songs (id, title) VALUES ('s2', 'Two')`).run();
    seedThread('t-s2', 's2');
    expect(() => db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES ('t-s2b', 's2')`).run()).toThrow(/UNIQUE/);
    expect(() => db.prepare(`INSERT INTO chat_messages (id, thread_id, seq, role, kind) VALUES ('x', 't-s2', 1, 'user', 'text')`).run()).toThrow(/UNIQUE/);
    db.prepare(`INSERT INTO chat_messages (id, thread_id, seq, role, kind, client_key) VALUES ('k1', 't-s2', 2, 'user', 'text', 'key')`).run();
    expect(() => db.prepare(`INSERT INTO chat_messages (id, thread_id, seq, role, kind, client_key) VALUES ('k2', 't-s2', 3, 'user', 'text', 'key')`).run()).toThrow(/UNIQUE/);
  });
});
