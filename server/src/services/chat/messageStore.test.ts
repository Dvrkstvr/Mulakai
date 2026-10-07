/** Messages in SQLite (F-041, F-042 edge): seq order, a double SEND is one row, last turns, outcome updates, chat_v bodies. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-messages-'));

const { db } = await import('../../db/index.js');
const { draftThread, resetDraftThread } = await import('./threadStore.js');
const { appendMessage, lastTurns, listMessages, messageById, readBody, updateMessage } = await import('./messageStore.js');

describe('appendMessage', () => {
  it('numbers messages 1, 2, 3 in the thread and lists them in order', () => {
    const t = draftThread();
    appendMessage(t.id, { role: 'user', kind: 'text', text: 'a song about the sea' });
    appendMessage(t.id, { role: 'assistant', kind: 'say', text: 'ok' });
    appendMessage(t.id, { role: 'user', kind: 'text', text: 'slower' });
    expect(listMessages(t.id).map((m) => [m.seq, m.role, m.text])).toEqual([
      [1, 'user', 'a song about the sea'], [2, 'assistant', 'ok'], [3, 'user', 'slower'],
    ]);
  });

  it('a double SEND with the same client key is one row: the replay returns the first', () => {
    const t = resetDraftThread();
    const first = appendMessage(t.id, { role: 'user', kind: 'text', text: 'hi', clientKey: 'k-1', jobId: 'job-1', body: { sentRev: 0 } });
    const again = appendMessage(t.id, { role: 'user', kind: 'text', text: 'hi', clientKey: 'k-1' });
    expect(first.replayed).toBe(false);
    expect(again).toEqual({ message: first.message, replayed: true });
    expect(listMessages(t.id)).toHaveLength(1);
  });

  it('the same client key in another thread is another message', () => {
    const a = resetDraftThread();
    appendMessage(a.id, { role: 'user', kind: 'text', clientKey: 'k' });
    db.prepare(`INSERT INTO songs (id, title) VALUES ('s', 'S')`).run();
    db.prepare(`UPDATE chat_threads SET song_id = 's' WHERE id = ?`).run(a.id);
    const b = draftThread();
    expect(appendMessage(b.id, { role: 'user', kind: 'text', clientKey: 'k' }).replayed).toBe(false);
  });

  it('stores the body with chat_v 1 and reads it back without the key', () => {
    const t = resetDraftThread();
    const body = { reasons: ['bar 999'], cause: 'check failed' };
    const { message } = appendMessage(t.id, { role: 'assistant', kind: 'failed', body });
    expect(message.body).toEqual(body);
    const raw = db.prepare(`SELECT body_json FROM chat_messages WHERE id = ?`).get(message.id) as { body_json: string };
    expect(JSON.parse(raw.body_json)).toEqual({ chat_v: 1, ...body });
  });
});

describe('readBody: the chat_v rule', () => {
  it('trap: a body of an unknown chat_v, or unreadable, is null, never a crash', () => {
    expect(readBody(JSON.stringify({ chat_v: 2, seconds: 1 }))).toBeNull();
    expect(readBody(JSON.stringify({ seconds: 1 }))).toBeNull();
    expect(readBody('{nope')).toBeNull();
    expect(readBody(null)).toBeNull();
  });
});

describe('lastTurns', () => {
  it('returns everything from the n-th last user message on', () => {
    const t = resetDraftThread();
    for (const [role, text] of [['user', 'u1'], ['assistant', 'a1'], ['user', 'u2'], ['assistant', 'a2'], ['user', 'u3']] as const) {
      appendMessage(t.id, { role, kind: role === 'user' ? 'text' : 'say', text });
    }
    expect(lastTurns(t.id, 2).map((m) => m.text)).toEqual(['u2', 'a2', 'u3']);
    expect(lastTurns(t.id, 4).map((m) => m.text)).toEqual(['u1', 'a1', 'u2', 'a2', 'u3']);
    expect(lastTurns(t.id, 0)).toEqual([]);
  });
});

describe('updateMessage', () => {
  it('sets job, proposal, version and outcome; keys not given stay; null clears', () => {
    const t = resetDraftThread();
    db.prepare(`INSERT INTO songs (id, title) VALUES ('sv', 'SV')`).run();
    db.prepare(`INSERT INTO layers (id, song_id, name) VALUES ('sv-l', 'sv', 'base')`).run();
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES ('sv-v', 'sv-l', 'a.wav')`).run();
    const { message } = appendMessage(t.id, { role: 'assistant', kind: 'recipe', text: 'here', proposalId: 'p1' });
    updateMessage(message.id, { jobId: 'job-9', versionId: 'sv-v' });
    expect(messageById(message.id)).toMatchObject({ jobId: 'job-9', versionId: 'sv-v', proposalId: 'p1', text: 'here' });
    const done = updateMessage(message.id, { kind: 'song', body: { seconds: 182, label: 'first generation', number: 1 }, proposalId: null });
    expect(done).toMatchObject({ kind: 'song', proposalId: null, body: { seconds: 182, label: 'first generation', number: 1 } });
    expect(updateMessage('missing', { text: 'x' })).toBeNull();
  });
});
