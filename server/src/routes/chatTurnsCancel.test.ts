/** CANCEL while thinking (C0a review #1): until the turn body has unloaded and written its cancelled reply, the
 * thread still has an open turn, so a second SEND is refused and turn 1's reply never lands after message 2. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-cancel-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { getJob } = await import('../services/jobRegistry.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { draftThread } = await import('../services/chat/threadStore.js');
const { listMessages } = await import('../services/chat/messageStore.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { makeChatTurnsRouter, TURN_OPEN } = await import('./chatTurns.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');

const ollama = await startFakeOllama();
let unloaded!: () => void;
let unloading = false;
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => true,
    create: () => createDeps(),
    turn: () => turnDeps({
      planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0,
      release: () => { unloading = true; return new Promise<void>((r) => { unloaded = r; }); },
    }),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`;
});
afterAll(async () => { resetQueue(); await ollama.close(); await new Promise<void>((r) => server.close(() => r())); });

const post = async (p: string, body: unknown = {}) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

describe('CANCEL while thinking', () => {
  it('the job reads cancelled at once; a SEND during the unload is refused; the cancelled reply follows message 1', async () => {
    ollama.chats.push({ hang: true });
    const thread = draftThread();
    const sent = await post(`/threads/${thread.id}/turns`, { text: 'one', clientKey: 'c1' });
    expect(sent.status).toBe(202);
    await vi.waitFor(() => expect(ollama.requests.some((r) => r.path === '/v1/chat/completions')).toBe(true));
    expect((await post(`/jobs/${sent.body.jobId}/cancel`)).body).toEqual({ ok: true, aborted: true });
    await vi.waitFor(() => expect(unloading).toBe(true));
    expect(getJob(sent.body.jobId)).toMatchObject({ status: 'failed', cancelled: true });

    expect(await post(`/threads/${thread.id}/turns`, { text: 'two', clientKey: 'c2' })).toEqual({ status: 409, body: { error: TURN_OPEN, reason: TURN_OPEN } });
    unloaded();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    expect(listMessages(thread.id).map((m) => [m.role, m.kind, m.text])).toEqual([['user', 'text', 'one'], ['assistant', 'failed', 'cancelled']]);
    expect((await post(`/threads/${thread.id}/turns`, { text: 'two', clientKey: 'c2' })).status).toBe(202);
  });
});
