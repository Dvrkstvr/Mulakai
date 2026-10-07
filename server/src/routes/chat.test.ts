/** The chat routes end to end on a temp DATA_DIR: fakeOllama for turns, a scripted take for CREATE SONG. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-route-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { RECIPE, recipeReply, sayReply } = await import('../../test-fakes/chatScripts.js');
const { db } = await import('../db/index.js');
const { enqueue, getRunning, resetQueue } = await import('../services/genQueue.js');
const { getJob, registerJob } = await import('../services/jobRegistry.js');
const { resetProposals } = await import('../services/chat/proposalStore.js');
const { resetDraftThread } = await import('../services/chat/threadStore.js');
const { turnDeps } = await import('../services/chat/turnJob.js');
const { createDeps } = await import('../services/chat/createFromDraft.js');
const { TRUNCATED_LABEL } = await import('../services/engineGenJobs.js');
const { makeChatRouter } = await import('./chat.js');
const { makeChatTurnsRouter } = await import('./chatTurns.js');
type Job = import('../services/jobRegistry.js').Job;

const ollama = await startFakeOllama();
let llm = true;
/** The scripted take: CREATE SONG's job, landed by hand with `land()`. */
const takes: Array<{ job: Job; fields: Record<string, unknown>; title: string; onSaved?: (songId: string) => void | Promise<void> }> = [];
let server: Server;
let base: string;

function insertSong(title: string, label = 'first generation'): string {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, ?, 192, 'yue2')`).run(songId, title);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', 'base')`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label) VALUES (?, ?, 'a.wav', ?)`).run(crypto.randomUUID(), layerId, label);
  return songId;
}
async function land(i = 0, label?: string) {
  const take = takes[i];
  const songId = insertSong(take.title, label);
  await take.onSaved?.(songId);
  take.job.status = 'done';
  take.job.songId = songId;
  return songId;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatRouter({ status: async () => ({ configured: true, assistant: 'ok', cause: null, yue: 'ok' }), yueConfigured: () => true }));
  app.use('/api/chat', makeChatTurnsRouter({
    llmConfigured: () => llm,
    turn: () => turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0 }),
    create: () => createDeps({
      engine: { id: 'yue2', label: 'YUE2', url: 'http://yue.test', apiKey: '' } as never, plannerConfigured: true, loaded: async () => [],
      start: (_e, fields, title, _f, _c, onSaved) => {
        const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'running', createdAt: Date.now() };
        registerJob(job);
        takes.push({ job, fields: fields as Record<string, unknown>, title, onSaved });
        return job;
      },
    }),
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/chat`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); await ollama.close(); });
afterEach(() => { resetQueue(); resetProposals(); resetDraftThread(); takes.length = 0; ollama.chats.length = 0; llm = true; });

const call = async (method: string, route: string, body?: unknown) => {
  const res = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() as Record<string, any> };
};
const settle = async (jobId: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(jobId)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
};
async function recipeTurn(text = 'a slow Spanish ballad about the sea') {
  const draft = (await call('GET', '/draft')).body;
  ollama.chats.push(recipeReply());
  const sent = await call('POST', `/threads/${draft.id}/turns`, { text, clientKey: crypto.randomUUID() });
  await settle(sent.body.jobId);
  return { draft, sent, thread: (await call('GET', `/threads/${draft.id}`)).body };
}

describe('chat routes', () => {
  it('GET /status, GET /draft: an empty draft thread on the wire shape', async () => {
    expect((await call('GET', '/status')).body).toMatchObject({ configured: true, assistant: 'ok' });
    const { body } = await call('GET', '/draft');
    expect(body).toMatchObject({ songId: null, messages: [], draft: { rev: 0, fields: { title: null, structure: [], engine: 'yue2' } } });
    expect(body.blockers).toContain('STYLE is empty: YuE2 has no default style, describe the sound');
  });

  it('PUT draft: a hand edit with the current rev; a stale rev is 409 {ok: false, current}', async () => {
    const { body: t } = await call('GET', '/draft');
    const ok = await call('PUT', `/threads/${t.id}/draft`, { fields: { style: 'dream pop', bpm: 92 }, rev: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ draft: { rev: 1, fields: { style: 'dream pop', bpm: 92 }, touched: { style: 1, bpm: 1 } }, blockers: [] });
    const stale = await call('PUT', `/threads/${t.id}/draft`, { fields: { bpm: 100 }, rev: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ ok: false, current: { rev: 1, fields: { bpm: 92 } } });
  });

  it('a turn: 202, the recipe card pending, the draft filled; a replayed key is the same turn (200)', async () => {
    const draft = (await call('GET', '/draft')).body;
    ollama.chats.push(recipeReply());
    const key = crypto.randomUUID();
    const sent = await call('POST', `/threads/${draft.id}/turns`, { text: 'a ballad', clientKey: key });
    expect(sent.status).toBe(202);
    const again = await call('POST', `/threads/${draft.id}/turns`, { text: 'a ballad', clientKey: key });
    expect(again).toMatchObject({ status: 200, body: { messageId: sent.body.messageId, jobId: sent.body.jobId } });
    await settle(sent.body.jobId);
    const thread = (await call('GET', `/threads/${draft.id}`)).body;
    expect(thread.messages.map((m: any) => [m.role, m.kind, m.state])).toEqual([['user', 'text', 'done'], ['assistant', 'recipe', 'pending']]);
    expect(thread.messages[0].body).toEqual({ chat_v: 1, sentRev: 0 });
    expect(thread.messages[1].body.recipe).toMatchObject({ title: RECIPE.title, timeSignature: '4/4' });
    expect(thread.draft.fields).toMatchObject({ title: RECIPE.title, language: 'es' });
    expect(thread.blockers).toEqual([]);
  });

  it('refuses a second turn while one is open, and any turn without LLM_API_URL, writing nothing', async () => {
    const draft = (await call('GET', '/draft')).body;
    enqueue({ kind: 'repaint', jobId: 'held' }, () => new Promise<void>(() => {}));
    expect((await call('POST', `/threads/${draft.id}/turns`, { text: 'one', clientKey: 'k1' })).status).toBe(202);
    const second = await call('POST', `/threads/${draft.id}/turns`, { text: 'two', clientKey: 'k2' });
    expect(second).toMatchObject({ status: 409, body: { reason: expect.stringContaining('still answering') } });
    resetQueue();
    resetDraftThread();
    llm = false;
    const fresh = (await call('GET', '/draft')).body;
    expect((await call('POST', `/threads/${fresh.id}/turns`, { text: 'x', clientKey: 'k3' })).status).toBe(409);
    expect((await call('GET', `/threads/${fresh.id}`)).body.messages).toEqual([]);
  });

  it('CANCEL a queued turn: the user message reads cancelled', async () => {
    const draft = (await call('GET', '/draft')).body;
    enqueue({ kind: 'repaint', jobId: 'held2' }, () => new Promise<void>(() => {}));
    const sent = await call('POST', `/threads/${draft.id}/turns`, { text: 'one', clientKey: 'k1' });
    expect(sent.body.position).toBe(1);
    expect((await call('POST', `/jobs/${sent.body.jobId}/cancel`)).body).toEqual({ ok: true, cancelled: true });
    const states = (await call('GET', `/threads/${draft.id}`)).body.messages.map((m: any) => m.state);
    expect(states).toEqual(['cancelled', 'cancelled']);
  });

  it('CREATE SONG sends the live draft, the card commits, the take lands: thread attached, song card, card done, a new draft thread', async () => {
    const { draft, thread } = await recipeTurn();
    await call('PUT', `/threads/${draft.id}/draft`, { fields: { bpm: 72 }, rev: thread.draft.rev });
    const card = thread.messages[1];
    const created = await call('POST', `/threads/${draft.id}/create`, { proposalId: card.proposalId });
    expect(created.status).toBe(202);
    expect(takes[0].fields).toMatchObject({ bpm: 72, key_scale: 'A minor', prompt: RECIPE.style });
    expect((await call('GET', `/threads/${draft.id}`)).body.messages[1]).toMatchObject({ state: 'committing', jobId: created.body.jobId });
    expect((await call('POST', `/threads/${draft.id}/create`, { proposalId: card.proposalId })).body.reason).toContain('already running');
    expect((await call('POST', '/draft/reset')).status).toBe(409);
    const songId = await land();
    const after = (await call('GET', `/threads/${draft.id}`)).body;
    expect(after.songId).toBe(songId);
    expect(after.messages.map((m: any) => [m.kind, m.state])).toEqual([['text', 'done'], ['recipe', 'done'], ['song', null]]);
    expect(after.messages[2]).toMatchObject({ body: { chat_v: 1, seconds: 192, label: 'first generation', number: 1, truncated: false }, versionId: expect.any(String) });
    expect((await call('GET', `/songs/${songId}/thread`)).body.id).toBe(draft.id);
    expect((await call('GET', '/draft')).body).toMatchObject({ songId: null, messages: [] });
  });

  it('a take cut at the length cap: the song card says truncated (F-044, D-025)', async () => {
    const { draft, thread } = await recipeTurn();
    expect((await call('POST', `/threads/${draft.id}/create`, { proposalId: thread.messages[1].proposalId })).status).toBe(202);
    await land(0, TRUNCATED_LABEL);
    const card = (await call('GET', `/threads/${draft.id}`)).body.messages[2];
    expect(card).toMatchObject({ kind: 'song', body: { label: TRUNCATED_LABEL, truncated: true } });
  });

  it('CREATE SONG refuses an expired card (a restart) and a superseded one, with the reason', async () => {
    const { draft, thread } = await recipeTurn();
    const first = thread.messages[1].proposalId;
    ollama.chats.push(recipeReply({ bpm: 60 }));
    const sent = await call('POST', `/threads/${draft.id}/turns`, { text: 'slower', clientKey: 'k' });
    await settle(sent.body.jobId);
    expect((await call('GET', `/threads/${draft.id}`)).body.messages.map((m: any) => m.state)).toEqual(['done', 'superseded', 'done', 'pending']);
    expect((await call('POST', `/threads/${draft.id}/create`, { proposalId: first })).body).toEqual({ reason: 'a newer proposal replaced this one' });
    resetProposals();
    expect((await call('POST', `/threads/${draft.id}/create`, { proposalId: first })).body).toEqual({ reason: 'this proposal expired: ask again' });
    expect((await call('GET', `/threads/${draft.id}`)).body.messages.map((m: any) => m.state)).toEqual(['done', 'expired', 'done', 'expired']);
  });

  it('a song made before the chat opens an empty thread; its turn sees the song; another song never shows it', async () => {
    const a = insertSong('Old Song');
    const b = insertSong('Other Song');
    const thread = (await call('GET', `/songs/${a}/thread`)).body;
    expect(thread).toMatchObject({ songId: a, messages: [] });
    ollama.chats.push(sayReply());
    const sent = await call('POST', `/threads/${thread.id}/turns`, { text: 'what is this song?', clientKey: 'k' });
    await settle(sent.body.jobId);
    const prompt = ollama.requests.filter((r) => r.path === '/v1/chat/completions').at(-1)!.body as { messages: Array<{ content: string }> };
    expect(prompt.messages[1].content).toContain('SONG: "Old Song"');
    expect((await call('GET', `/songs/${b}/thread`)).body.messages).toEqual([]);
    expect((await call('GET', '/songs/nope/thread')).status).toBe(404);
  });

  it('NEW CHAT drops the draft thread and its messages', async () => {
    const { draft } = await recipeTurn();
    const fresh = await call('POST', '/draft/reset');
    expect(fresh.status).toBe(200);
    expect(fresh.body.id).not.toBe(draft.id);
    expect((await call('GET', `/threads/${draft.id}`)).status).toBe(404);
  });
});
