/** SEND with a reference (C3, F-061): `attach` names one of the draft thread's references and rides on the user
 * message; a song thread refuses it (D-130); a READ that will queue the follow-up turn keeps SEND off (D-129). */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-attach-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { sayReply } = await import('../../test-fakes/chatScripts.js');
const { db } = await import('../db/index.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { registerJob } = await import('../services/jobRegistry.js');
const { draftThread, resetDraftThread, songThread } = await import('../services/chat/threadStore.js');
const { appendMessage, listMessages } = await import('../services/chat/messageStore.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');
const { ATTACH_ON_SONG, makeChatTurnsRouter, TURN_OPEN } = await import('./chatTurns.js');

const ollama = await startFakeOllama();
ollama.chats.push(sayReply('Got it.'));
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => true, create: () => createDeps(),
    turn: () => turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0 }),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterEach(async () => { await vi.waitFor(() => expect(getRunning()).toBeNull()); resetQueue(); resetDraftThread(); });
afterAll(async () => { await ollama.close(); await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string, body: unknown) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
function newSong(): string {
  const songId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Done')`).run(songId);
  return songId;
}
function addRef(threadId: string): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, file, bytes, sha256, seconds) VALUES (?, ?, 'upload', 'demo.mp3', ?, 1, ?, 200)`)
    .run(id, threadId, `references/${id}.wav`, id);
  return id;
}

describe('POST /threads/:id/turns with attach', () => {
  it('stores the attach on the user message and starts the turn', async () => {
    const thread = draftThread();
    const ref = addRef(thread.id);
    const sent = await post(`/threads/${thread.id}/turns`, { text: 'like this, but in German', clientKey: 'a1', attach: { referenceId: ref } });
    expect(sent.status).toBe(202);
    expect(listMessages(thread.id)[0]).toMatchObject({ role: 'user', body: { sentRev: 0, attach: { referenceId: ref } } });
  });

  it('a malformed attach or a reference of another chat is refused, nothing stored', async () => {
    const thread = draftThread();
    expect((await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: 'a2', attach: 'demo.mp3' })).status).toBe(400);
    const other = addRef(songThread(newSong()).id);
    expect(await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: 'a3', attach: { referenceId: other } }))
      .toEqual({ status: 400, body: { error: 'that reference is not attached to this chat' } });
    expect(listMessages(thread.id)).toEqual([]);
  });

  it('a song thread refuses an attach and points to NEW CHAT (D-130)', async () => {
    const thread = songThread(newSong());
    const ref = addRef(thread.id);
    expect(await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: 'a4', attach: { referenceId: ref } }))
      .toEqual({ status: 409, body: { error: ATTACH_ON_SONG, reason: ATTACH_ON_SONG } });
  });

  it('a reading that will queue the follow-up turn keeps SEND off until it settles (D-129); RE-ANALYZE\'s does not', async () => {
    const thread = draftThread();
    const ref = addRef(thread.id);
    const jobId = crypto.randomUUID();
    registerJob({ id: jobId, taskId: '', status: 'running', createdAt: Date.now() });
    const body = (followUp: boolean) => ({ referenceId: ref, name: 'demo.mp3', followUp, reading: null });
    const card = appendMessage(thread.id, { role: 'assistant', kind: 'reading', text: 'reading', body: body(true), jobId }).message;
    expect(await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: 'a5' })).toEqual({ status: 409, body: { error: TURN_OPEN, reason: TURN_OPEN } });
    db.prepare(`UPDATE chat_messages SET body_json = ? WHERE id = ?`).run(JSON.stringify({ chat_v: 1, ...body(false) }), card.id);
    expect((await post(`/threads/${thread.id}/turns`, { text: 'x', clientKey: 'a6' })).status).toBe(202);
  });
});
