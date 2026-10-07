/** CREATE COVER (F-063 commit, D-128): createFromDraft's cover branch re-checks the reference and its reading
 * (coverBlockers) and hands the reading's score to the take as `cover`; CREATE SONG's GPU check is gpuGuard's. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatcover-test-'));

const { RECIPE, readingFixture } = await import('../../../test-fakes/chatScripts.js');
const { createDeps, createFromDraft } = await import('./createFromDraft.js');
const { appendMessage } = await import('./messageStore.js');
const { propose, resetProposals } = await import('./proposalStore.js');
const { draftThread, resetDraftThread, writeDraft } = await import('./threadStore.js');
const { recipeFields } = await import('./draftModel.js');
const store = await import('./referenceStore.js');
type Job = import('../jobRegistry.js').Job;
type Reading = import('./reading.js').Reading;

afterEach(() => { resetProposals(); resetDraftThread(); start.mockClear(); });

function wav(): Buffer {
  const data = Buffer.alloc(16000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** A draft thread whose live card is a cover of an uploaded reference read as `reading` (null: not read). */
function coverCard(reading: Reading | null = readingFixture(), use: 'cover' | 'borrow' = 'cover') {
  const t = draftThread();
  const added = store.fromUpload(t.id, { data: wav(), filename: `ref-${crypto.randomUUID()}.wav` });
  if (!added.ok) throw new Error(added.reason);
  if (reading) store.setReading(added.reference.id, reading);
  writeDraft(t.id, 0, { ...t.draft, rev: 1, fields: recipeFields(RECIPE), reference: { referenceId: added.reference.id, use } });
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(t.id, { role: 'assistant', kind: 'recipe', text: 'x', proposalId });
  propose({ id: proposalId, threadId: t.id, messageId: message.id, createdAt: 0, kind: 'recipe', recipe: RECIPE });
  return { threadId: t.id, proposalId, ref: added.reference };
}
const start = vi.fn((): Job => ({ id: 'take', taskId: '', status: 'running', createdAt: 0 }));
const deps = (over: Parameters<typeof createDeps>[0] = {}) =>
  createDeps({ engine: { id: 'yue2', url: 'http://yue.test' } as never, plannerConfigured: true, loaded: async () => [], planRunning: () => false, start, ...over });

describe('CREATE COVER (F-063)', () => {
  it('passes the reading\'s score as the cover, named after the reference', async () => {
    const { threadId, proposalId, ref } = coverCard();
    expect(await createFromDraft(threadId, proposalId, deps())).toHaveProperty('job');
    const call = start.mock.calls[0] as unknown[];
    expect(call[4]).toEqual({ abc: (readingFixture().score as { abc: string }).abc, source: ref.name });
  });

  it('a borrow is CREATE SONG as before: no cover argument', async () => {
    const { threadId, proposalId } = coverCard(readingFixture(), 'borrow');
    expect(await createFromDraft(threadId, proposalId, deps())).toHaveProperty('job');
    expect((start.mock.calls[0] as unknown[])[4]).toBeUndefined();
  });

  it('refuses a reference that is not read or whose score failed, with the reason', async () => {
    const unread = coverCard(null);
    expect(await createFromDraft(unread.threadId, unread.proposalId, deps())).toEqual({ reason: 'the reference has not been read: press READ first' });
    resetDraftThread();
    const failed = coverCard(readingFixture({ score: { notRead: 'YUE_API_URL is not set' } }));
    expect(await createFromDraft(failed.threadId, failed.proposalId, deps())).toEqual({ reason: 'a cover is not possible: the score was not read: YUE_API_URL is not set' });
    expect(start).not.toHaveBeenCalled();
  });

  it('refuses while a planner model is on the GPU (gpuGuard), like CREATE SONG', async () => {
    const { threadId, proposalId } = coverCard();
    const out = await createFromDraft(threadId, proposalId, deps({ loaded: async () => [{ name: 'qwen3:14b', contextLength: 16384 }] }));
    expect((out as { reason: string }).reason).toContain('qwen3:14b');
    expect(start).not.toHaveBeenCalled();
  });
});
