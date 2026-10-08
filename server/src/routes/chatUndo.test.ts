/** UNDO TURN's route (F-059, D-220) on a temp DATA_DIR: draft and message body written together, the refusals. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-undo-test-'));

const { RECIPE } = await import('../../test-fakes/chatScripts.js');
const { db } = await import('../db/index.js');
const { registerJob } = await import('../services/jobRegistry.js');
const { applyRecipe, handEdit } = await import('../services/chat/draftModel.js');
const { appendMessage, messageById } = await import('../services/chat/messageStore.js');
const { attach, draftThread, resetDraftThread, songThread, threadById, writeDraft } = await import('../services/chat/threadStore.js');
const { makeChatRouter } = await import('./chat.js');
type RecipeBody = import('../services/chat/chatTypes.js').RecipeBody;

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatRouter({ status: async () => ({ configured: true, assistant: 'ok', cause: null, yue: 'ok' }), yueConfigured: () => true }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/chat`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
afterEach(() => { resetDraftThread(); });

const call = async (route: string) => {
  const res = await fetch(`${base}${route}`, { method: 'POST' });
  return { status: res.status, body: await res.json() as Record<string, any> };
};

/** The draft thread after a typed title and a recipe turn (what turnDispatch writes). */
function turned() {
  const thread = draftThread();
  const typed = handEdit(thread.draft, { title: 'Mine' }).draft;
  writeDraft(thread.id, thread.draft.rev, typed);
  const merged = applyRecipe(typed, RECIPE, typed.rev);
  writeDraft(thread.id, typed.rev, merged.draft);
  const body: RecipeBody = {
    recipe: RECIPE, assumptions: [], changed: merged.changed, skipped: [], undo: { rev: merged.draft.rev, before: merged.before, fields: merged.changed },
  };
  appendMessage(thread.id, { role: 'user', kind: 'text', text: 'a ballad', body: { sentRev: typed.rev } });
  const { message } = appendMessage(thread.id, { role: 'assistant', kind: 'recipe', body });
  return { threadId: thread.id, messageId: message.id, typedRev: typed.rev };
}
const undo = (threadId: string, messageId: string) => call(`/threads/${threadId}/messages/${messageId}/undo`);

describe('POST /threads/:id/messages/:messageId/undo', () => {
  it('restores the turn\'s fields, keeps a hand edit since, marks the body undone; the view reads done', async () => {
    const { threadId, messageId } = turned();
    const now = threadById(threadId)!.draft;
    writeDraft(threadId, now.rev, handEdit(now, { style: 'my own style' }).draft);
    const { status, body } = await undo(threadId, messageId);
    expect(status).toBe(200);
    expect(body.draft.fields).toMatchObject({ title: 'Mine', style: 'my own style', bpm: null, lyrics: [] });
    expect(body.kept).toEqual([{ field: 'style', reason: 'you changed it' }]);
    expect(body.restored).toContain('title');
    expect(body.blockers).toEqual(expect.any(Array));
    const stored = messageById(messageId)!.body as RecipeBody;
    expect(stored.undone).toMatchObject({ restored: body.restored, kept: body.kept });
    const view = await fetch(`${base}/threads/${threadId}`).then((r) => r.json()) as { messages: Array<{ id: string; undo: unknown }> };
    expect(view.messages.find((m) => m.id === messageId)?.undo).toBe('done');
  });

  it('a second undo is refused and changes nothing', async () => {
    const { threadId, messageId } = turned();
    expect((await undo(threadId, messageId)).status).toBe(200);
    const rev = threadById(threadId)!.draft.rev;
    const again = await undo(threadId, messageId);
    expect(again).toMatchObject({ status: 409, body: { error: 'UNDO_REFUSED', reason: 'this turn was already undone' } });
    expect(threadById(threadId)!.draft.rev).toBe(rev);
  });

  it('refused while a turn is open (TURN_OPEN), and on a song thread; nothing written', async () => {
    const { threadId, messageId } = turned();
    const job = { id: crypto.randomUUID(), taskId: '', status: 'running' as const, createdAt: Date.now() };
    registerJob(job);
    const open = appendMessage(threadId, { role: 'user', kind: 'text', text: 'slower', body: { sentRev: 0 }, jobId: job.id }).message;
    expect(await undo(threadId, messageId)).toMatchObject({ status: 409, body: { error: 'TURN_OPEN' } });
    job.status = 'done' as never;
    db.prepare(`DELETE FROM chat_messages WHERE id = ?`).run(open.id);
    const songId = crypto.randomUUID();
    db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'x', 1, 'yue2')`).run(songId);
    attach(threadId, songId);
    expect(await undo(threadId, messageId)).toMatchObject({ status: 409, body: { error: 'UNDO_REFUSED' } });
    expect((messageById(messageId)!.body as RecipeBody).undone).toBeUndefined();
  });

  it('a message with no record is 409; an unknown thread, message or another thread\'s message is 404', async () => {
    const { threadId, messageId } = turned();
    const say = appendMessage(threadId, { role: 'assistant', kind: 'say', text: 'hi' }).message;
    expect(await undo(threadId, say.id)).toMatchObject({ status: 409, body: { error: 'UNDO_REFUSED' } });
    expect((await undo('nope', messageId)).status).toBe(404);
    expect((await undo(threadId, 'nope')).status).toBe(404);
    const songId = crypto.randomUUID();
    db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'y', 1, 'yue2')`).run(songId);
    expect((await undo(songThread(songId).id, messageId)).status).toBe(404);
  });
});
