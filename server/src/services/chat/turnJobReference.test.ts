/** The C3 turn on the real genQueue against fakeOllama: an analyze reply is a READ card with its proposal; the
 * follow-up turn after a reading writes no user message, offers ask / recipe / say, unloads like any turn, and
 * its recipe carries the fields code filled from the reading (F-061, F-063, F-064, D-128, D-129). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatturn-ref-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { analyzeReply, borrowReply, coverReply, readingFixture } = await import('../../../test-fakes/chatScripts.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { db } = await import('../../db/index.js');
const { draftThread, resetDraftThread, threadById } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { liveAnalyze, proposalLife, resetProposals } = await import('./proposalStore.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type Reading = import('./reading.js').Reading;

let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetDraftThread(); });

const deps = () => turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0 });
function addRef(threadId: string, name: string, reading: Reading | null = null): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, file, bytes, sha256, seconds, reading_json) VALUES (?, ?, 'upload', ?, ?, 1, ?, 200, ?)`)
    .run(id, threadId, name, `references/${id}.wav`, id, reading ? JSON.stringify(reading) : null);
  return id;
}
function send(text: string, attach?: string) {
  const thread = draftThread();
  const body = { sentRev: thread.draft.rev, ...(attach ? { attach: { referenceId: attach } } : {}) };
  return { thread, user: appendMessage(thread.id, { role: 'user', kind: 'text', text, body, clientKey: crypto.randomUUID() }).message };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const lastChat = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions').at(-1)!.body as { messages: Array<{ content: string }>; response_format: { json_schema: { schema: { anyOf: Array<{ properties: { action: { const: string } } }> } } } };

describe('chat turn with a reference', () => {
  it('an analyze reply on an attached file: a READ card with a live analyze proposal; the prompt named the file', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(analyzeReply('demo.mp3'));
    const thread = draftThread();
    const ref = addRef(thread.id, 'demo.mp3');
    const { user } = send('like this, but in German', ref);
    expect((await settled(startChatTurn(thread.id, user, null, deps()).id)).status).toBe('done');
    expect(lastChat().messages[1].content).toContain('ATTACHED: "demo.mp3" (3:20, not read yet)');
    expect(lastChat().response_format.json_schema.schema.anyOf.map((p) => p.properties.action.const)).toEqual(['ask', 'analyze', 'say']);
    expect(lastChat().messages[0].content).not.toContain('- scalpel: ');
    const card = listMessages(thread.id).at(-1)!;
    expect(card).toMatchObject({ kind: 'analyze', body: { target: { referenceId: ref }, name: 'demo.mp3', seconds: 200, cut: false } });
    expect(proposalLife(card.proposalId!)).toBe('live');
    expect(liveAnalyze(thread.id)?.id).toBe(card.proposalId);
  });

  it('follow-up (D-129): no user message written, ask / recipe / say only, a cover recipe filled from the score, unloaded', async () => {
    ollama = await startFakeOllama({ listedPolls: 1 });
    ollama.chats.push(coverReply());
    const thread = draftThread();
    const ref = addRef(thread.id, 'demo.mp3', readingFixture());
    const { user } = send('like this, but in Spanish', ref);
    const before = listMessages(thread.id).length;
    const job = startChatTurn(thread.id, user, null, deps(), { followUp: ref });
    expect(getRunning()).toMatchObject({ kind: 'plan', jobId: job.id, label: 'chat turn' });
    expect((await settled(job.id)).status).toBe('done');
    expect(ollama.loaded).toBeNull();
    const sent = lastChat();
    expect(sent.response_format.json_schema.schema.anyOf.map((p) => p.properties.action.const)).toEqual(['ask', 'recipe', 'say']);
    expect(sent.messages[0].content).toContain('reference_use');
    expect(sent.messages[1].content).toContain('REFERENCE: "demo.mp3"');
    expect(sent.messages[1].content).toContain('REQUEST: like this, but in Spanish');
    const messages = listMessages(thread.id);
    expect(messages).toHaveLength(before + 1);
    expect(messages.at(-1)).toMatchObject({ kind: 'recipe', body: { reference: { referenceId: ref, use: 'cover', missing: [] } } });
    expect(threadById(thread.id)!.draft).toMatchObject({ fields: { bpm: 96, key: 'Am' }, reference: { referenceId: ref, use: 'cover' } });
  });

  it('trap (F-064): a borrow on a reading with no key leaves the key blank, whatever the model wrote', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(borrowReply({ key: 'E' }));
    const thread = draftThread();
    const r = readingFixture({ caption: { notRead: 'ACE-Step is not running' }, score: { notRead: 'yue-server is not running' } });
    const ref = addRef(thread.id, 'demo.mp3', r);
    const { user } = send('a song like this', ref);
    await settled(startChatTurn(thread.id, user, null, deps(), { followUp: ref }).id);
    const draft = threadById(thread.id)!.draft;
    expect(draft.fields.key).toBeUndefined();
    expect(draft.missing).toEqual(['bpm', 'key', 'timeSignature']);
    expect(listMessages(thread.id).at(-1)!.body).toMatchObject({ reference: { use: 'borrow', missing: ['bpm', 'key', 'timeSignature'] } });
  });
});
