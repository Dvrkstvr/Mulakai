/**
 * Chat threads in SQLite (docs/decisions/0007, D-102): the one draft thread (song_id NULL) and
 * one thread per song. CREATE SONG attaches the draft thread to the new song, so its messages
 * move with it; the next draftThread() starts an empty one. The draft is read through
 * draftModel.readDraft (draft_v rule) and written with a rev check.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import { readDraft } from './draftModel.js';
import type { ChatThread, Draft } from './chatTypes.js';

interface Row { id: string; song_id: string | null; draft_json: string; created_at: string; updated_at: string }

function decode(row: Row): ChatThread {
  const { draft, note } = readDraft(row.draft_json);
  return { id: row.id, songId: row.song_id, draft, draftNote: note, createdAt: row.created_at, updatedAt: row.updated_at };
}

const rowById = (id: string) => db.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(id) as Row | undefined;

export function threadById(id: string): ChatThread | null {
  const row = rowById(id);
  return row ? decode(row) : null;
}

function insert(songId: string | null): ChatThread {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES (?, ?)`).run(id, songId);
  return decode(rowById(id)!);
}

/** The one draft thread (no song yet), created on first use. */
export const draftThread = db.transaction((): ChatThread => {
  const row = db.prepare(`SELECT * FROM chat_threads WHERE song_id IS NULL`).get() as Row | undefined;
  return row ? decode(row) : insert(null);
});

/** NEW CHAT: drop the draft thread and its messages (they cascade), start an empty one. */
export const resetDraftThread = db.transaction((): ChatThread => {
  db.prepare(`DELETE FROM chat_threads WHERE song_id IS NULL`).run();
  return insert(null);
});

/** A song's thread, created empty on first open (a song made before the chat has none).
 * Throws when the song does not exist (the foreign key). */
export const songThread = db.transaction((songId: string): ChatThread => {
  const row = db.prepare(`SELECT * FROM chat_threads WHERE song_id = ?`).get(songId) as Row | undefined;
  return row ? decode(row) : insert(songId);
});

/** CREATE SONG landed: the draft thread becomes the song's thread (order kept, nothing copied).
 * Refuses a thread that already has a song, or a song that already has a thread. */
export const attach = db.transaction((threadId: string, songId: string): ChatThread => {
  const row = rowById(threadId);
  if (!row) throw new Error(`chat thread ${threadId} not found`);
  if (row.song_id === songId) return decode(row);
  if (row.song_id !== null) throw new Error(`chat thread ${threadId} already belongs to song ${row.song_id}`);
  db.prepare(`UPDATE chat_threads SET song_id = ?, updated_at = datetime('now') WHERE id = ?`).run(songId, threadId);
  return decode(rowById(threadId)!);
});

export type DraftWrite = { ok: true; thread: ChatThread } | { ok: false; current: Draft };

/** Write `next` only if the stored draft is still at `expectedRev` (the rev the caller read);
 * otherwise nothing is written and the current draft comes back (the route's 409). */
export const writeDraft = db.transaction((threadId: string, expectedRev: number, next: Draft): DraftWrite => {
  const row = rowById(threadId);
  if (!row) throw new Error(`chat thread ${threadId} not found`);
  const current = readDraft(row.draft_json).draft;
  if (current.rev !== expectedRev) return { ok: false, current };
  db.prepare(`UPDATE chat_threads SET draft_json = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(next), threadId);
  return { ok: true, thread: decode(rowById(threadId)!) };
});
