/** The edit turn (F-046, F-065 chat half) on the real genQueue against fakeOllama and the recorded yue-server
 * apply replies: one plan slot through the attempts and the unload; the card is a planStore plan; a failed
 * plan stores nothing; a song that cannot be edited gets the reason as a say. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatedit-test-'));

const { db } = await import('../../db/index.js');
const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { editReply, reply, reviseEdit, sayReply } = await import('../../../test-fakes/chatScripts.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { songThread } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { editById, liveEdit, proposalLife, resetProposals } = await import('./proposalStore.js');
const { getPlan, resetPlans } = await import('../score/planStore.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('../score/scoreStatus.js').ScoreStatus;
type ApplyResult = import('../score/planTypes.js').ApplyResult;
type EditBody = import('./chatTypes.js').EditBody;

const facts = contract('read-ok').response.body.facts;
const applied = contract('apply-reharmonize').response.body as ApplyResult;
const REHARM = contract('apply-reharmonize').request.body.ops as unknown[];
const status = (over: Partial<ScoreStatus> = {}, chordsPresent = true): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's', activeVersionId: 'v1', abc: 'X:1', style: 'dark pop', lyrics: '[Verse]\nwalking out', fingerprint: 'f1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent, bpm: 87, seconds: 179.3, tokens: 1832, facts },
  ...over,
});

let ollama: FakeOllama;
const events: string[] = [];
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetPlans(); events.length = 0; });

function setup(st: ScoreStatus = status(), apply = async (): Promise<ApplyResult> => applied) {
  const songId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'Rain', 179, 'yue2')`).run(songId);
  const thread = songThread(songId);
  const applyEdit = vi.fn(async () => { events.push('apply'); return apply(); });
  const d = turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, source: { status: async () => st }, applyEdit });
  const deps = { ...d, release: async () => { events.push('unload'); const r = await d.release(); events.push('empty'); return r; } };
  const send = (text: string) => {
    const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
    return startChatTurn(thread.id, message, songId, deps);
  };
  return { songId, thread, send, applyEdit };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const last = (threadId: string) => listMessages(threadId).at(-1)!;

describe('chat edit turn (CB-2)', () => {
  it('an edit is applied inside the turn\'s slot and becomes an edit card over the song\'s planStore plan (F-046 #1, #2)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply(REHARM, 'Jazz chords on bar 43.'));
    const { songId, thread, send } = setup();
    const job = send('give bar 43 jazz chords');
    expect(getRunning()).toMatchObject({ kind: 'plan', label: 'chat turn', songId });
    expect((await settled(job.id)).status).toBe('done');
    expect(events).toEqual(['apply', 'unload', 'empty']);
    const card = last(thread.id);
    const body = card.body as EditBody;
    expect(card).toMatchObject({ role: 'assistant', kind: 'edit', text: 'Jazz chords on bar 43.' });
    expect(body).toMatchObject({ ops: REHARM, splice: { splice: true, kind: 'reharmonize', from_bar: 43, to_bar: 43 }, renderMode: { cot: 'full', reason: 'chords' } });
    expect(getPlan(songId)).toMatchObject({ id: body.planId, baseVersionId: 'v1', fingerprint: 'f1', request: 'give bar 43 jazz chords', abc: applied.abc });
    expect(proposalLife(card.proposalId!)).toBe('live');
    expect(editById(card.proposalId!)?.planId).toBe(body.planId);
  });

  it('a follow-up edit while the card is pending revises it (C2, F-058): a new plan, the old card reads REPLACED (F-046 #3)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply(REHARM), reviseEdit([1], [{ op: 'SET_TEMPO', bpm: 96 }]));
    const { songId, thread, send } = setup(status(), async () => contract('apply-set-tempo').response.body as ApplyResult);
    await settled(send('jazz chords on bar 43').id);
    const first = last(thread.id);
    await settled(send('no, just faster').id);
    const second = last(thread.id);
    expect(proposalLife(first.proposalId!)).toBe('superseded');
    expect(proposalLife(second.proposalId!)).toBe('live');
    expect(getPlan(songId)?.id).toBe((second.body as EditBody).planId);
    expect((second.body as EditBody).splice).toMatchObject({ splice: false });
    expect(second.body).toMatchObject({ revision: 2, ops: [{ op: 'SET_TEMPO', bpm: 96 }], since: { removed: REHARM } });
  });

  it('F-065 edge: REHARMONIZE on a chord-free score takes the whole-song path and renders with chords', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply(REHARM));
    const { thread, send } = setup(status({}, false));
    await settled(send('add jazz chords on bar 43').id);
    expect(last(thread.id).body).toMatchObject({
      splice: { splice: false, reason: 'the song has no chords: adding them renders the whole song with chords' },
      renderMode: { cot: 'full', reason: 'reharmonize' },
    });
  });

  it('F-046 edge: a plan failing its checks 3 times (over 360 s) shows the reasons, stores nothing, still unloads', async () => {
    ollama = await startFakeOllama();
    // The retries carry the reasons, so the prompt grows: the fake reports the tokens it would read.
    ollama.chats.push(reply({ action: 'edit', message: 'Slower.', assumptions: [], ops: [{ op: 'SET_TEMPO', bpm: 40 }] }, 9000));
    const slow = { ...(contract('apply-set-tempo').response.body as ApplyResult), seconds: 458 };
    const { songId, thread, send } = setup(status(), async () => slow);
    expect((await settled(send('much slower').id)).status).toBe('failed');
    expect(events).toEqual(['apply', 'apply', 'apply', 'unload', 'empty']);
    const failed = last(thread.id);
    expect(failed).toMatchObject({ kind: 'failed', body: { cause: 'check' } });
    expect((failed.body as { reasons: string[] }).reasons.join(' ')).toMatch(/458/);
    expect(getPlan(songId)).toBeUndefined();
    expect(liveEdit(thread.id)).toBeUndefined();
  });

  it('F-046 edge: a song that is not score-eligible gets the eligibility reason as a say, no plan and no apply', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply(REHARM));
    const reason = 'This song has a repaint version, so score editing ended when it was made.';
    const { songId, thread, send, applyEdit } = setup({ eligibility: { state: 'ineligible', reason }, source: null, read: null });
    await settled(send('jazz chords').id);
    expect(last(thread.id)).toMatchObject({ kind: 'say', proposalId: null });
    expect(last(thread.id).text).toContain(reason);
    expect(applyEdit).not.toHaveBeenCalled();
    expect(getPlan(songId)).toBeUndefined();
  });

  it('a say on a song thread stores no plan', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(sayReply('It is in D minor.'));
    const { songId, thread, send } = setup();
    await settled(send('what key is it in?').id);
    expect(last(thread.id)).toMatchObject({ kind: 'say' });
    expect(getPlan(songId)).toBeUndefined();
  });
});
