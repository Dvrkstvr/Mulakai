/** READ at the click and RE-ANALYZE (F-061 commit, F-062, D-129): the re-checks, the reading card, the analyze card's
 * job, and the hand-off to the follow-up turn when the reading saves. The reading job and the turn are fakes. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-read-commit-'));

const { readingFixture } = await import('../../../test-fakes/chatScripts.js');
const { QueueFullError } = await import('../genQueue.js');
const { appendMessage, listMessages, messageById } = await import('./messageStore.js');
const { propose, resetProposals } = await import('./proposalStore.js');
const { attach, draftThread, resetDraftThread } = await import('./threadStore.js');
const store = await import('./referenceStore.js');
const { readCommitDeps, readFromCard, reread } = await import('./readCommit.js');
const { db } = await import('../../db/index.js');
type Job = import('../jobRegistry.js').Job;
type ReadingOptions = import('./readingJob.js').ReadingOptions;
type ReadCommitDeps = import('./readCommit.js').ReadCommitDeps;

afterEach(() => { resetProposals(); resetDraftThread(); });

function wav(): Buffer {
  const data = Buffer.alloc(16000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** The draft thread: the person's request (with the file attached), then the turn's READ card. */
function analyzeCard() {
  const t = draftThread();
  const added = store.fromUpload(t.id, { data: wav(), filename: 'Kopf Hoch.wav' });
  if (!added.ok) throw new Error(added.reason);
  const { message: user } = appendMessage(t.id, { role: 'user', kind: 'text', text: 'like this but in German', body: { sentRev: 0, attach: { referenceId: added.reference.id } } });
  const proposalId = crypto.randomUUID();
  const target = { referenceId: added.reference.id };
  const { message: card } = appendMessage(t.id, { role: 'assistant', kind: 'analyze', text: 'I can read it', proposalId });
  propose({ id: proposalId, threadId: t.id, messageId: card.id, createdAt: 0, kind: 'analyze', target });
  return { threadId: t.id, proposalId, ref: added.reference, user, card };
}

const job = (id: string): Job => ({ id, taskId: '', status: 'queued', createdAt: 0 });
function fakes(over: Partial<ReadCommitDeps> = {}) {
  const started: Array<{ referenceId: string; opts: ReadingOptions }> = [];
  const turns: Array<{ threadId: string; origin: string; referenceId: string }> = [];
  const deps = readCommitDeps({
    guard: async () => null,
    start: (referenceId, opts) => { started.push({ referenceId, opts }); return job(`read-${started.length}`); },
    followUp: (threadId, origin, referenceId) => { turns.push({ threadId, origin: origin.id, referenceId }); return job('turn-1'); },
    ...over,
  });
  return { deps, started, turns };
}

describe('READ (F-061 commit)', () => {
  it('appends a reading card holding the reading job; the analyze card holds it too (committing)', async () => {
    const { threadId, proposalId, ref, card } = analyzeCard();
    const { deps, started } = fakes();
    expect(await readFromCard(threadId, proposalId, deps)).toEqual({ job: expect.objectContaining({ id: 'read-1' }) });
    const reading = listMessages(threadId).at(-1)!;
    expect(reading).toMatchObject({ kind: 'reading', jobId: 'read-1', body: { referenceId: ref.id, name: 'Kopf Hoch.wav', followUp: true, reading: null } });
    expect(started[0]).toMatchObject({ referenceId: ref.id, opts: { threadId, cardId: reading.id } });
    expect(messageById(card.id)?.jobId).toBe('read-1');
  });

  it('when the reading saves, the follow-up turn re-asks the origin request and the card moves to its job (D-129)', async () => {
    const { threadId, proposalId, ref, user } = analyzeCard();
    const { deps, started, turns } = fakes();
    await readFromCard(threadId, proposalId, deps);
    started[0].opts.onRead!(readingFixture(), ref);
    expect(turns).toEqual([{ threadId, origin: user.id, referenceId: ref.id }]);
    expect(listMessages(threadId).at(-1)).toMatchObject({ kind: 'reading', jobId: 'turn-1' });
  });

  it('a follow-up that cannot queue says so in a failed line; the card keeps the reading', async () => {
    const { threadId, proposalId, ref } = analyzeCard();
    const { deps, started } = fakes({ followUp: () => { throw new QueueFullError(); } });
    await readFromCard(threadId, proposalId, deps);
    started[0].opts.onRead!(readingFixture(), ref);
    const [card, failed] = listMessages(threadId).slice(-2);
    expect(card).toMatchObject({ kind: 'reading', jobId: 'read-1' });
    expect(failed).toMatchObject({ kind: 'failed', body: { cause: 'offline' } });
  });

  it('re-checks at the click: expired, superseded, already read, a song thread, the GPU, a full queue', async () => {
    const a = analyzeCard();
    const { deps } = fakes();
    expect(await readFromCard(a.threadId, 'nope', deps)).toEqual({ reason: 'this proposal expired: ask again' });
    expect(await readFromCard('other', a.proposalId, deps)).toEqual({ reason: 'this chat no longer exists' });
    expect(await readFromCard(a.threadId, a.proposalId, fakes({ guard: async () => 'qwen3:14b is loaded' }).deps)).toEqual({ reason: 'qwen3:14b is loaded' });
    expect(await readFromCard(a.threadId, a.proposalId, fakes({ start: () => { throw new QueueFullError(); } }).deps)).toEqual({ reason: new QueueFullError().message });
    expect(listMessages(a.threadId).filter((m) => m.kind === 'reading')).toEqual([]); // nothing left behind
    await readFromCard(a.threadId, a.proposalId, deps);
    expect(await readFromCard(a.threadId, a.proposalId, deps)).toEqual({ reason: 'this card was already read' });
    const b = analyzeCard(); // a newer READ card supersedes
    propose({ id: 'newer', threadId: b.threadId, messageId: b.card.id, createdAt: 0, kind: 'analyze', target: { referenceId: b.ref.id } });
    expect(await readFromCard(b.threadId, b.proposalId, deps)).toEqual({ reason: 'a newer proposal replaced this one' });
    const songId = crypto.randomUUID();
    db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'x')`).run(songId);
    attach(b.threadId, songId);
    expect((await readFromCard(b.threadId, 'newer', deps) as { reason: string }).reason).toContain('NEW CHAT');
  });

  it('refused while a reading or a turn of this thread is still open', async () => {
    const a = analyzeCard();
    const { deps } = fakes({ busy: () => true });
    expect((await readFromCard(a.threadId, a.proposalId, deps) as { reason: string }).reason).toContain('still working');
  });
});

describe('RE-ANALYZE (F-062)', () => {
  it('a new reading card with no follow-up turn', async () => {
    const { threadId, ref } = analyzeCard();
    const { deps, started } = fakes();
    expect(await reread(ref.id, deps)).toEqual({ job: expect.objectContaining({ id: 'read-1' }) });
    expect(listMessages(threadId).at(-1)).toMatchObject({ kind: 'reading', jobId: 'read-1', body: { referenceId: ref.id, followUp: false } });
    expect(started[0].opts.onRead).toBeUndefined();
  });

  it('refused for an unknown reference, while busy, and while a model is loaded', async () => {
    const { ref } = analyzeCard();
    expect(await reread('nope', fakes().deps)).toEqual({ reason: 'this reference no longer exists' });
    expect((await reread(ref.id, fakes({ busy: () => true }).deps) as { reason: string }).reason).toContain('still working');
    expect(await reread(ref.id, fakes({ guard: async () => 'loaded' }).deps)).toEqual({ reason: 'loaded' });
  });
});
