/** The chat turn on the real genQueue against fakeOllama (F-042 #1, F-049 #1/#2): one slot from the first
 * call to the confirmed unload on every path; a failed turn changes nothing. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatturn-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { RECIPE, outOfSet, recipeReply, sayReply } = await import('../../../test-fakes/chatScripts.js');
const { enqueue, getQueued, getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { draftThread, resetDraftThread, threadById, writeDraft } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { handEdit } = await import('./draftModel.js');
const { liveProposal, proposalLife, resetProposals } = await import('./proposalStore.js');
const { cancelTurn, startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;

let ollama: FakeOllama;
const events: string[] = [];
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetDraftThread(); events.length = 0; });

function deps(over: Parameters<typeof turnDeps>[0] = {}) {
  const d = turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, ...over });
  const { ask, release } = d;
  return { ...d, ask: async (...a: Parameters<typeof ask>) => { events.push('ask'); return ask(...a); },
    release: async () => { events.push('unload'); const r = await release(); events.push('empty'); return r; } };
}

function send(text: string, over: Parameters<typeof turnDeps>[0] = {}) {
  const thread = draftThread();
  const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
  return { thread, user: message, job: startChatTurn(thread.id, message, null, deps(over)) };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const reply = (threadId: string) => listMessages(threadId).at(-1)!;

describe('chat turn job', () => {
  it('a recipe: one plan slot through the attempts and the unload; a repaint queued meanwhile waits; card, draft and proposal written', async () => {
    ollama = await startFakeOllama({ listedPolls: 2 });
    ollama.chats.push(outOfSet(), recipeReply());
    const { thread, job } = send('a slow Spanish ballad about the sea');
    expect(getRunning()).toMatchObject({ kind: 'plan', jobId: job.id, label: 'chat turn' });
    enqueue({ kind: 'repaint', jobId: crypto.randomUUID() }, () => { events.push(`repaint (loaded: ${ollama.loaded})`); });
    expect((await settled(job.id)).status).toBe('done');
    await vi.waitFor(() => expect(events.at(-1)).toMatch(/^repaint/));
    expect(events).toEqual(['ask', 'ask', 'unload', 'empty', 'repaint (loaded: null)']);
    const card = reply(thread.id);
    expect(card).toMatchObject({ role: 'assistant', kind: 'recipe', body: { recipe: RECIPE, skipped: [] } });
    expect(proposalLife(card.proposalId!)).toBe('live');
    expect(threadById(thread.id)!.draft.fields).toMatchObject({ title: RECIPE.title, key: 'Am', language: 'es' });
  });

  it('three replies outside the set: a failed message with the reasons, still unloaded, nothing else changes', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(outOfSet());
    const { thread, job } = send('do a dance');
    expect((await settled(job.id)).status).toBe('failed');
    expect(events).toEqual(['ask', 'ask', 'ask', 'unload', 'empty']);
    expect(reply(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'check', reasons: ['action "dance" is not one of ask, recipe, edit, scalpel, analyze, say'] } });
    expect(threadById(thread.id)!.draft.rev).toBe(0);
    expect(liveProposal(thread.id)).toBeUndefined();
  });

  it('the model not pulled: offline (ASSISTANT OFF) with the fix, no call made', async () => {
    ollama = await startFakeOllama({ models: ['llama3'] });
    const { thread, job } = send('a song');
    await settled(job.id);
    expect(events).toEqual([]);
    expect(reply(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'offline', reasons: ["model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'"] } });
  });

  it('a context too short refuses naming OLLAMA_CONTEXT_LENGTH=16384, never proposing from it', async () => {
    ollama = await startFakeOllama({ contextLength: 4096 });
    ollama.chats.push(recipeReply());
    const { thread, job } = send('a song');
    await settled(job.id);
    expect(events).toEqual(['ask', 'unload', 'empty']);
    const failed = reply(thread.id);
    expect(failed).toMatchObject({ kind: 'failed', body: { cause: 'context' } });
    expect(failed.text).toContain('OLLAMA_CONTEXT_LENGTH=16384');
    expect(liveProposal(thread.id)).toBeUndefined();
  });

  it('an unload not confirmed ends the turn naming `ollama stop`, the reply is not written', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(sayReply());
    const { thread, job } = send('hi', { release: async () => { throw new Error("the planner model qwen3:14b is still loaded after 10 s: run 'ollama stop qwen3:14b'"); } });
    await settled(job.id);
    expect(reply(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'unload' } });
    expect(reply(thread.id).text).toContain('ollama stop qwen3:14b');
  });

  it('CANCEL while thinking aborts the call, still unloads before the slot frees, and writes a cancelled line', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ hang: true });
    const { thread, job } = send('a song');
    await vi.waitFor(() => expect(events).toEqual(['ask']));
    expect(cancelTurn(job.id)).toEqual({ aborted: true });
    expect((await settled(job.id)).error).toBe('Aborted');
    expect(events).toEqual(['ask', 'unload', 'empty']);
    expect(reply(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'cancelled' } });
    expect(threadById(thread.id)!.draft.rev).toBe(0);
  });

  it('CANCEL while queued leaves the line with a cancelled line and never asks', async () => {
    ollama = await startFakeOllama();
    let release!: () => void;
    enqueue({ kind: 'repaint', jobId: 'held' }, () => new Promise<void>((r) => { release = r; }));
    const { thread, job } = send('a song');
    expect(getQueued().map((q) => q.jobId)).toEqual([job.id]);
    expect(cancelTurn(job.id)).toEqual({ cancelled: true });
    expect(getJob(job.id)).toMatchObject({ status: 'failed', cancelled: true });
    expect(reply(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'cancelled' } });
    release();
    expect(events).toEqual([]);
  });

  it('a field typed during the turn is kept and named (CH-6)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ hang: true });
    const { thread, job } = send('a ballad');
    await vi.waitFor(() => expect(events).toEqual(['ask']));
    const typed = handEdit(thread.draft, { title: 'Mine' }).draft;
    expect(writeDraft(thread.id, 0, typed).ok).toBe(true);
    cancelTurn(job.id);
    await settled(job.id);
    ollama.chats.length = 0;
    ollama.chats.push(recipeReply());
    const { user } = { user: appendMessage(thread.id, { role: 'user', kind: 'text', text: 'again', body: { sentRev: 0 } }).message };
    const next = startChatTurn(thread.id, user, null, deps());
    await settled(next.id);
    expect(reply(thread.id).body).toMatchObject({ skipped: ['title'] });
    expect(threadById(thread.id)!.draft.fields.title).toBe('Mine');
  });
});
