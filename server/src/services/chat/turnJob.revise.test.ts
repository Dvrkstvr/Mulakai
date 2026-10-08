/** REVISE as a follow-up turn (F-058, D-227) on the real genQueue against fakeOllama and the recorded yue-server
 * apply replies: plan 1 SET_TEMPO 88 (`apply-set-tempo`), then "and jazz chords in bars 47-50" merges to
 * `apply-compound`'s ops and is stored as plan 2 with `since`; a failed, offline or cancelled revise leaves the
 * card live and the song's plan unchanged; a changed song or a dock PLAN plans fresh (architecture.md "Test
 * strategy (C2)" #1). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatrevise-test-'));

const { db } = await import('../../db/index.js');
const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { COMPOUND_OPS, REVISE, editReply, sayReply } = await import('../../../test-fakes/chatScripts.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { songThread } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { liveEdit, proposalLife, resetProposals } = await import('./proposalStore.js');
const { getPlan, resetPlans, setPlan } = await import('../score/planStore.js');
const { cancelTurn, startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('../score/scoreStatus.js').ScoreStatus;
type ApplyResult = import('../score/planTypes.js').ApplyResult;
type Op = import('../score/planTypes.js').Op;
type EditBody = import('./chatTypes.js').EditBody;
type TurnDeps = import('./turnJob.js').TurnDeps;

const facts = contract('read-ok').response.body.facts;
const TEMPO = COMPOUND_OPS[0] as Op;
const FIXTURES = ['apply-set-tempo', 'apply-compound', 'apply-transpose', 'apply-reharmonize'];
/** The recorded reply whose request had exactly these ops (yue-server's own answer for them). */
const recorded = (ops: Op[]): ApplyResult => {
  const name = FIXTURES.find((f) => JSON.stringify(contract(f).request.body.ops) === JSON.stringify(ops));
  if (!name) throw new Error(`no recorded apply for ${JSON.stringify(ops)}`);
  return contract(name).response.body as ApplyResult;
};
const status = (fingerprint = 'f1'): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's', activeVersionId: 'v1', abc: 'X:1', style: 'dark pop', lyrics: '[Verse]\nwalking out', fingerprint } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts },
});

let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetPlans(); });

function setup(fingerprints: string[] = ['f1']) {
  const songId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'Rain', 179, 'yue2')`).run(songId);
  const thread = songThread(songId);
  const applyEdit = vi.fn(async (_base: unknown, ops: Op[]) => recorded(ops));
  let turn = 0;
  const source = { status: async () => status(fingerprints[Math.min(turn++, fingerprints.length - 1)]) };
  const deps = turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, source, applyEdit });
  const send = (text: string, over: Partial<TurnDeps> = {}) => {
    const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
    return startChatTurn(thread.id, message, songId, { ...deps, ...over });
  };
  return { songId, thread, send, applyEdit };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const last = (threadId: string) => listMessages(threadId).at(-1)!;
const chats = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions')
  .map((r) => r.body as { messages: Array<{ content: string }>; response_format: unknown });

/** Plan 1: SET_TEMPO 88, a live edit card over the song's plan. */
async function planOne(s: ReturnType<typeof setup>) {
  await settled(s.send('make it faster').id);
  const card = last(s.thread.id);
  expect(card.kind).toBe('edit');
  return { card, planId: (card.body as EditBody).planId };
}

describe('REVISE as a follow-up turn (F-058)', () => {
  it('"and jazz chords in bars 47-50": plan 2 = apply-compound\'s ops, SAME + NEW, applied once to the base; the old card reads superseded', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), REVISE.additive());
    const s = setup();
    const one = await planOne(s);
    expect((await settled(s.send('and jazz chords in bars 47-50, as a jazz trio').id)).status).toBe('done');
    const card = last(s.thread.id);
    const body = card.body as EditBody;
    expect(body.ops).toEqual(COMPOUND_OPS);
    expect(body.revision).toBe(2);
    expect(body.since).toEqual({ planId: one.planId, marks: [{ mark: 'SAME', was: TEMPO }, { mark: 'NEW', was: null }, { mark: 'NEW', was: null }], removed: [] });
    expect(body.map?.ops.map((o) => o.whole)).toEqual([true, false, true]);
    expect(s.applyEdit).toHaveBeenLastCalledWith({ abc: 'X:1', style: 'dark pop', lyrics: '[Verse]\nwalking out' }, COMPOUND_OPS);
    expect(getPlan(s.songId)).toMatchObject({ id: body.planId, revision: 2, since: body.since, ops: COMPOUND_OPS });
    expect(proposalLife(one.card.proposalId!)).toBe('superseded');
    expect(proposalLife(card.proposalId!)).toBe('live');
    const [, second] = chats();
    expect(second.messages[1].content).toContain('PENDING PLAN (plan 1, made for: "make it faster"):\nop 1 SET_TEMPO {"bpm":88}: applied');
    expect(JSON.stringify(second.response_format)).toContain('"drop"');
    expect(JSON.stringify(chats()[0].response_format)).not.toContain('"drop"');
  });

  it('a chain: "fewer chords" drops what plan 2 added and lists it under REMOVED; "forget that" replaces all (REMOVED + NEW)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), REVISE.additive(), REVISE.drop(2, 3), REVISE.replace(1));
    const s = setup();
    await planOne(s);
    await settled(s.send('and jazz chords in bars 47-50, as a jazz trio').id);
    await settled(s.send('fewer chords').id);
    const three = last(s.thread.id).body as EditBody;
    expect(three).toMatchObject({ revision: 3, ops: [TEMPO] });
    expect(three.since?.removed).toEqual(COMPOUND_OPS.slice(1));
    await settled(s.send('forget that, transpose it down a tone').id);
    const four = last(s.thread.id).body as EditBody;
    expect(four).toMatchObject({ revision: 4, ops: [{ op: 'TRANSPOSE', semitones: -2 }], since: { marks: [{ mark: 'NEW', was: null }], removed: [TEMPO] } });
  });

  it('a revise failing 3 times (a merge over 6 ops, named) leaves the card live and the song\'s plan unchanged', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), REVISE.overSix());
    const s = setup();
    const one = await planOne(s);
    expect((await settled(s.send('add everything').id)).status).toBe('failed');
    expect(last(s.thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'check' } });
    expect(last(s.thread.id).text).toContain('the revised plan has 7 ops; at most 6');
    expect(getPlan(s.songId)?.id).toBe(one.planId);
    expect(liveEdit(s.thread.id)?.planId).toBe(one.planId);
    expect(proposalLife(one.card.proposalId!)).toBe('live');
  });

  it('an offline or cancelled revise, or a say, leaves the card live and the plan unchanged', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), { ...sayReply('It is at 88 BPM now.'), promptTokens: 4500 }, { hang: true });
    const s = setup();
    const one = await planOne(s);
    await settled(s.send('and jazz chords', { probe: async () => 'the planner is not running' }).id);
    expect(last(s.thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'offline' } });
    await settled(s.send('how fast is it now?').id);
    expect(last(s.thread.id)).toMatchObject({ kind: 'say' });
    const job = s.send('and jazz chords');
    await vi.waitFor(() => expect(chats()).toHaveLength(3));
    expect(cancelTurn(job.id)).toEqual({ aborted: true });
    await settled(job.id);
    expect(last(s.thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'cancelled' } });
    expect(getPlan(s.songId)?.id).toBe(one.planId);
    expect(proposalLife(one.card.proposalId!)).toBe('live');
  });

  it('the song changed since the card (fingerprint): no revise, a fresh plan 1 with no since', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), { ...editReply(COMPOUND_OPS), promptTokens: 4500 });
    const s = setup(['f1', 'f2']);
    await planOne(s);
    await settled(s.send('jazz chords in bars 47-50 too').id);
    const body = last(s.thread.id).body as EditBody;
    expect(body.ops).toEqual(COMPOUND_OPS);
    expect('since' in body || 'revision' in body).toBe(false);
    expect(chats()[1].messages[1].content).not.toContain('PENDING PLAN');
  });

  it('a dock PLAN that replaced the chat\'s plan: the card expired, the next message plans fresh', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(editReply([TEMPO]), { ...editReply(COMPOUND_OPS), promptTokens: 4500 });
    const s = setup();
    await planOne(s);
    setPlan({ ...getPlan(s.songId)!, id: 'dock-plan' });
    await settled(s.send('jazz chords in bars 47-50 too').id);
    expect('since' in (last(s.thread.id).body as EditBody)).toBe(false);
    expect(chats()[1].messages[1].content).not.toContain('PENDING PLAN');
  });
});

