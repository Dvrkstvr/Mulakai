/** READ and RE-ANALYZE over HTTP (F-061 commit, F-062): 202 {jobId} | 409 {reason}, the thread view's analyze and
 * reading card states, and the hand edit's refusals on a cover draft (D-148 c). The reading job is a fake. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-read-route-'));

const { readingFixture } = await import('../../test-fakes/chatScripts.js');
const { registerJob } = await import('../services/jobRegistry.js');
const { appendMessage } = await import('../services/chat/messageStore.js');
const { propose, resetProposals } = await import('../services/chat/proposalStore.js');
const { readCommitDeps } = await import('../services/chat/readCommit.js');
const store = await import('../services/chat/referenceStore.js');
const { draftThread, resetDraftThread, writeDraft } = await import('../services/chat/threadStore.js');
const { makeChatRouter } = await import('./chat.js');
const { makeChatReferencesRouter } = await import('./chatReferences.js');
type Job = import('../services/jobRegistry.js').Job;

function wav(): Buffer {
  const data = Buffer.alloc(16000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

let guard: string | null = null;
let jobs: Job[] = [];
let server: Server;
let base: string;
beforeAll(async () => {
  const deps = () => readCommitDeps({
    guard: async () => guard,
    start: () => { const j: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() }; registerJob(j); jobs.push(j); return j; },
    busy: () => false,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatRouter({ status: async () => ({ configured: true, assistant: 'ok', cause: null, yue: 'ok' }), yueConfigured: () => true }));
  app.use('/api/chat', makeChatReferencesRouter(deps));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/chat`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
afterEach(() => { resetProposals(); resetDraftThread(); guard = null; jobs = []; });

const call = async (method: string, route: string, body?: unknown) => {
  const res = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() as Record<string, any> };
};

function analyzeCard() {
  const t = draftThread();
  const added = store.fromUpload(t.id, { data: wav(), filename: 'take.wav' });
  if (!added.ok) throw new Error(added.reason);
  appendMessage(t.id, { role: 'user', kind: 'text', text: 'like this', body: { sentRev: 0 } });
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(t.id, { role: 'assistant', kind: 'analyze', text: 'READ?', proposalId });
  propose({ id: proposalId, threadId: t.id, messageId: message.id, createdAt: 0, kind: 'analyze', target: { referenceId: added.reference.id } });
  return { threadId: t.id, proposalId, ref: added.reference };
}
const states = async (threadId: string) =>
  ((await call('GET', `/threads/${threadId}`)).body.messages as Array<{ kind: string; state: string }>).filter((m) => m.kind === 'analyze' || m.kind === 'reading').map((m) => `${m.kind}:${m.state}`);

describe('POST /threads/:id/read and /references/:id/read', () => {
  it('READ: 202 {jobId}; the analyze card is committing and the reading card queued, then reading', async () => {
    const { threadId, proposalId } = analyzeCard();
    const res = await call('POST', `/threads/${threadId}/read`, { proposalId });
    expect(res).toEqual({ status: 202, body: { jobId: jobs[0].id } });
    expect(await states(threadId)).toEqual(['analyze:committing', 'reading:queued']);
    jobs[0].status = 'running';
    expect(await states(threadId)).toEqual(['analyze:committing', 'reading:reading']);
    jobs[0].status = 'failed'; jobs[0].error = 'take.wav could not be read: the file is gone';
    expect(await states(threadId)).toEqual(['analyze:done', 'reading:failed']);
  });

  it('409 {reason} on a refused re-check; 400 without a proposal id; 404 an unknown chat', async () => {
    const { threadId, proposalId } = analyzeCard();
    guard = 'the planner qwen3:14b is still on the GPU';
    expect(await call('POST', `/threads/${threadId}/read`, { proposalId })).toEqual({ status: 409, body: { reason: guard } });
    expect((await call('POST', `/threads/${threadId}/read`, {})).status).toBe(400);
    expect((await call('POST', `/threads/nope/read`, { proposalId })).status).toBe(404);
    expect(await call('POST', `/threads/${threadId}/read`, { proposalId: 'gone' })).toEqual({ status: 409, body: { reason: 'this proposal expired: ask again' } });
  });

  it('RE-ANALYZE: 202 and a new reading card with no follow-up; 409 for an unknown reference', async () => {
    const { threadId, ref } = analyzeCard();
    expect((await call('POST', `/references/${ref.id}/read`)).status).toBe(202);
    const last = (await call('GET', `/threads/${threadId}`)).body.messages.at(-1);
    expect(last).toMatchObject({ kind: 'reading', state: 'queued', body: { followUp: false, reading: null } });
    expect(await call('POST', '/references/nope/read')).toEqual({ status: 409, body: { reason: 'this reference no longer exists' } });
  });
});

describe('a cover draft over HTTP (D-148 c, F-063)', () => {
  it('PUT draft names the locked fields it refused; the thread view lists a cover\'s blockers', async () => {
    const { threadId, ref } = analyzeCard();
    const t = draftThread();
    writeDraft(t.id, 0, { ...t.draft, rev: 1, fields: { bpm: 96 }, reference: { referenceId: ref.id, use: 'cover' }, borrowed: ['bpm'] });
    const put = await call('PUT', `/threads/${threadId}/draft`, { fields: { bpm: 120, style: 'punk' }, rev: 1 });
    expect(put.status).toBe(200);
    expect(put.body.refused).toEqual([{ field: 'bpm', reason: expect.any(String) }]);
    expect(put.body.draft.fields).toMatchObject({ bpm: 96, style: 'punk' });
    expect(put.body.blockers).toContain('the reference has not been read: press READ first');
    store.setReading(ref.id, readingFixture());
    expect((await call('GET', `/threads/${threadId}`)).body.blockers).not.toContain('the reference has not been read: press READ first');
  });
});
