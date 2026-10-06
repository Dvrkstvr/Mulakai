/** Threads in SQLite (F-041): the draft thread, a song's thread, attach on CREATE SONG, NEW CHAT, the draft's rev check. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-threads-'));

const { db } = await import('../../db/index.js');
const { attach, draftThread, resetDraftThread, songThread, threadById, writeDraft } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { emptyDraft, handEdit } = await import('./draftModel.js');

const song = (id: string) => db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(id, `Song ${id}`);
const say = (threadId: string, text: string) => appendMessage(threadId, { role: 'user', kind: 'text', text });

describe('the draft thread', () => {
  it('is created once and found again, with an empty v1 draft', () => {
    const t = draftThread();
    expect(t.songId).toBeNull();
    expect(t.draft).toEqual(emptyDraft());
    expect(t.draftNote).toBeNull();
    expect(draftThread().id).toBe(t.id);
  });

  it('NEW CHAT drops it and its messages and starts an empty one', () => {
    const old = draftThread();
    say(old.id, 'one');
    say(old.id, 'two');
    const fresh = resetDraftThread();
    expect(fresh.id).not.toBe(old.id);
    expect(threadById(old.id)).toBeNull();
    expect(listMessages(old.id)).toEqual([]);
    expect(draftThread().id).toBe(fresh.id);
  });
});

describe('attach: CREATE SONG makes the draft thread the song\'s thread', () => {
  it('keeps the messages in order, nothing copied; the next draft thread is empty; a second song never sees them', () => {
    const t = draftThread();
    ['a', 'b', 'c'].forEach((x) => say(t.id, x));
    song('s1');
    const attached = attach(t.id, 's1');
    expect(attached.songId).toBe('s1');
    expect(songThread('s1').id).toBe(t.id);
    expect(listMessages(t.id).map((m) => m.text)).toEqual(['a', 'b', 'c']);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM chat_messages`).get()).toEqual({ n: 3 });

    const next = draftThread();
    expect(next.id).not.toBe(t.id);
    expect(listMessages(next.id)).toEqual([]);
    song('s2');
    const t2 = attach(next.id, 's2');
    expect(listMessages(t2.id)).toEqual([]);
  });

  it('is idempotent for the same song and refuses a thread that has another song', () => {
    const t = songThread('s1');
    expect(attach(t.id, 's1').id).toBe(t.id);
    song('s3');
    expect(() => attach(t.id, 's3')).toThrow(/already belongs to song s1/);
    expect(() => attach('nope', 's3')).toThrow(/not found/);
  });
});

describe('songThread', () => {
  it('a song made before the chat gets an empty thread on first open (F-041 edge)', () => {
    song('legacy');
    const t = songThread('legacy');
    expect(t.songId).toBe('legacy');
    expect(listMessages(t.id)).toEqual([]);
    expect(songThread('legacy').id).toBe(t.id);
  });

  it('a song that does not exist has no thread (foreign key)', () => {
    expect(() => songThread('ghost')).toThrow(/FOREIGN KEY/);
  });
});

describe('writeDraft: the rev check', () => {
  it('writes when the stored rev is the one read, and the draft reads back', () => {
    const t = resetDraftThread();
    const next = handEdit(t.draft, { title: 'Mine' }).draft;
    const res = writeDraft(t.id, 0, next);
    expect(res.ok).toBe(true);
    expect(threadById(t.id)!.draft).toEqual(next);
  });

  it('refuses a stale rev and returns the current draft (the route\'s 409)', () => {
    const t = draftThread();
    const res = writeDraft(t.id, 0, handEdit(t.draft, { title: 'Late' }).draft);
    expect(res).toEqual({ ok: false, current: t.draft });
    expect(threadById(t.id)!.draft.fields.title).toBe('Mine');
  });

  it('an unknown draft_v stored reads as an empty draft with a note', () => {
    const t = draftThread();
    db.prepare(`UPDATE chat_threads SET draft_json = ? WHERE id = ?`).run(JSON.stringify({ draft_v: 9, rev: 4 }), t.id);
    const read = threadById(t.id)!;
    expect(read.draft).toEqual(emptyDraft());
    expect(read.draftNote).toMatch(/draft_v 9/);
  });
});
