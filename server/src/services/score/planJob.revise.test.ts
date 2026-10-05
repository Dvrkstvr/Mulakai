/** REVISE and "this" through the `plan` job (F-032, F-033): the pending plan in the prompt, the marks on the
 * replacing plan, D-063 (a failed REVISE keeps plan 1) beside D-028 (a failed PLAN drops it), the per-press
 * load-unload hand-off, and a pick checked at the job's turn. Real genQueue, fakeOllama, recorded facts. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-planjob-revise-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { abortJob, getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps, CHECK_FAILED } = await import('./planJob.js');
const { getPlan, lastRun, resetPlans } = await import('./planStore.js');
const { NOTHING_REVISED, PLAN_REPLACED, PLAN_STALE } = await import('./planRevise.js');
const { buildReviseSchema, REVISE_REPLY, REVISE_RETRY } = await import('./reviseReply.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;
type ApplyResult = import('./planTypes.js').ApplyResult;
type Op = import('./planTypes.js').Op;

const read = contract('read-ok');
const base = contract('apply-compound').request.body as { abc: string; style: string; lyrics: string };
const SONG = 'song-1';
let fingerprint = 'f1';
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: base.lyrics, fingerprint } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 145, seconds: 278, tokens: 1832, facts: read.response.body.facts as never },
});
const TEMPO: Op = { op: 'SET_TEMPO', bpm: 88 };
const STYLE: Op = { op: 'EDIT_STYLE', style: 'dark pop, jazz' };
const plan = (...ops: Op[]) => ({ content: JSON.stringify({ ops }) });
const applied = (ops: Op[]): ApplyResult => ({
  ok: true, abc: base.abc, style: base.style, verdicts: ops.map((o, i) => ({ index: i + 1, op: o.op, ok: true, reason: null })),
  checks: { ok: true, problems: [], differences: [] }, changed: { abc: true, style: true },
  chords_present: true, bpm: 88, seconds: 183, tokens: 1520,
});
const BAD = plan({ op: 'SET_TEMPO', bpm: 999 });
const revised = (drop: number[], ...ops: Op[]) => ({ content: JSON.stringify({ drop, ops }) });
const HARM: Op = { op: 'REHARMONIZE', from_bar: 47, to_bar: 48, chords: [{ bar: 47, beat: 1, root: 'D', quality: 'm7' }, { bar: 48, beat: 1, root: 'G', quality: '7' }] };
const UP_2: Op = { op: 'TRANSPOSE', semitones: 2 };
const REPEAT_3: Op = { op: 'REPEAT', section: 3, label: 'chorus' };
const LYRICS_2: Op = { op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['hold on to the sea'] };
const CHORUS = { kind: 'section', section: 3, label: 'chorus', occurrence: 1, of: 1, bars: [47, 62] } as const;

let ollama: FakeOllama;
const events: string[] = [];
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); events.length = 0; fingerprint = 'f1'; });

function deps() {
  const d = planDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, status: async () => status(), apply: async (_b, ops) => applied(ops) });
  const { ask, release } = d;
  return { ...d, ask: async (...a: Parameters<typeof ask>) => { events.push('ask'); return ask(...a); },
    release: async () => { events.push('unload'); const r = await release(); events.push('empty'); return r; } };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const asks = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions')
  .map((r) => (r.body as { messages: Array<{ content: string }> }).messages[1].content);
const schemas = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions')
  .map((r) => (r.body as { response_format: { json_schema: { schema: unknown } } }).response_format.json_schema.schema);
async function plan1() {
  ollama.chats.splice(0, ollama.chats.length, plan(TEMPO, STYLE));
  expect((await settled(startPlan(SONG, 'make it jazzier', deps()).id)).status).toBe('done');
  events.length = 0;
  return getPlan(SONG)!;
}

describe('REVISE (F-033)', () => {
  it('shows the planner the pending plan, merges its {drop, ops} reply, and marks what changed since; each press loads and unloads', async () => {
    ollama = await startFakeOllama();
    const first = await plan1();
    expect(first).toMatchObject({ revision: 1, since: null, referent: null });
    ollama.chats.splice(0, 1, revised([2], { op: 'SET_TEMPO', bpm: 92 }));
    const job = await settled(startPlan(SONG, 'a bit faster, and drop the style change', deps(), { revise: first.id }).id);
    expect(job.status).toBe('done');
    expect(asks()[1]).toContain('PENDING PLAN (plan 1, made for: "make it jazzier"):\nop 1 SET_TEMPO {"bpm":88}: applied\n'
      + 'op 2 EDIT_STYLE {"style":"dark pop, jazz"}: applied\n');
    expect(asks()[1]).toMatch(/not as the pending plan would leave it\.\n\nREQUEST: a bit faster, and drop the style change\n/);
    expect(asks()[1].endsWith(`\n${REVISE_REPLY}`)).toBe(true);
    expect(schemas()[1]).toEqual(buildReviseSchema(read.response.body.facts as never, 2));
    const second = getPlan(SONG)!;
    expect(second.ops).toEqual([{ op: 'SET_TEMPO', bpm: 92 }]);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ revision: 2, request: 'a bit faster, and drop the style change',
      since: { planId: first.id, marks: [{ mark: 'CHANGED', was: TEMPO }], removed: [STYLE] } });
    expect(lastRun(SONG)).toMatchObject({ jobId: job.id, planId: second.id, revise: first.id, cause: null });
    expect(events).toEqual(['ask', 'unload', 'empty']); // the hand-off is unchanged per press (D-011)
  });

  it('keeps every pending op on an additive revision and applies the merged plan (CP3, Q-050)', async () => {
    ollama = await startFakeOllama();
    const sent: Op[][] = [];
    ollama.chats.splice(0, ollama.chats.length, plan(HARM, UP_2, REPEAT_3, LYRICS_2));
    const d = { ...deps(), apply: async (_b: unknown, ops: Op[]) => { sent.push(ops); return applied(ops); } };
    await settled(startPlan(SONG, 'jazz chords, up a tone, repeat the chorus, new chorus words', d).id);
    const first = getPlan(SONG)!;
    ollama.chats.splice(0, 1, revised([], { op: 'SET_TEMPO', bpm: 80 }));
    expect((await settled(startPlan(SONG, 'also slow it down to 80 BPM', d, { revise: first.id }).id)).status).toBe('done');
    const merged = [HARM, UP_2, REPEAT_3, LYRICS_2, { op: 'SET_TEMPO', bpm: 80 }];
    expect(sent.at(-1)).toEqual(merged);
    expect(getPlan(SONG)).toMatchObject({ ops: merged, since: { planId: first.id, removed: [] } });
    expect(getPlan(SONG)!.since!.marks.map((m) => m.mark)).toEqual(['SAME', 'SAME', 'SAME', 'SAME', 'NEW']);
  });

  it('retries a drop outside the pending plan and an empty reply with the reason, then takes a good reply', async () => {
    ollama = await startFakeOllama();
    const first = await plan1();
    ollama.chats.splice(0, 1, revised([3]), revised([]), revised([1]));
    const job = await settled(startPlan(SONG, 'no tempo change', deps(), { revise: first.id }).id);
    expect(job.status).toBe('done');
    expect(events).toEqual(['ask', 'ask', 'ask', 'unload', 'empty']);
    const feedback = (n: number) => (ollama.requests.filter((r) => r.path === '/v1/chat/completions')[n].body as { messages: Array<{ content: string }> })
      .messages.at(-1)!.content;
    expect(feedback(2)).toBe(`Your op list was rejected:\n- drop 3 is not a pending op number (1-2)\n${REVISE_RETRY}`);
    expect(feedback(3)).toBe(`Your op list was rejected:\n- ${NOTHING_REVISED}\n${REVISE_RETRY}`);
    expect(getPlan(SONG)).toMatchObject({ ops: [STYLE], attempts: 3, since: { marks: [{ mark: 'SAME', was: STYLE }], removed: [TEMPO] } });
  });

  it('keeps plan 1 available when the REVISE fails its 3 attempts, still unloading (D-063)', async () => {
    ollama = await startFakeOllama();
    const first = await plan1();
    ollama.chats.splice(0, 1, revised([], { op: 'SET_TEMPO', bpm: 999 }));
    const job = await settled(startPlan(SONG, 'way faster', deps(), { revise: first.id }).id);
    expect(job.error).toMatch(new RegExp(`^${CHECK_FAILED}: op 1 \\(SET_TEMPO\\): bpm 999`));
    expect(events).toEqual(['ask', 'ask', 'ask', 'unload', 'empty']);
    expect(getPlan(SONG)).toBe(first);
    expect(lastRun(SONG)).toMatchObject({ cause: 'check', revise: first.id, planId: null });
  });

  it('keeps plan 1 when the REVISE is cancelled', async () => {
    ollama = await startFakeOllama();
    const first = await plan1();
    ollama.chats.splice(0, 1, { hang: true });
    const job = startPlan(SONG, 'way faster', deps(), { revise: first.id });
    await vi.waitFor(() => expect(asks()).toHaveLength(2));
    abortJob(job.id);
    await settled(job.id);
    expect(getPlan(SONG)).toBe(first);
    expect(lastRun(SONG)).toMatchObject({ cause: 'cancelled', revise: first.id });
  });

  it('a failed fresh PLAN still drops plan 1 (D-028)', async () => {
    ollama = await startFakeOllama();
    await plan1();
    ollama.chats.splice(0, 1, BAD);
    await settled(startPlan(SONG, 'way faster', deps()).id);
    expect(getPlan(SONG)).toBeUndefined();
    expect(lastRun(SONG)).toMatchObject({ cause: 'check', revise: null });
  });

  it('refuses a REVISE of a replaced plan or one made on another score, before the planner loads', async () => {
    ollama = await startFakeOllama();
    const first = await plan1();
    await settled(startPlan(SONG, 'faster', deps(), { revise: 'old-plan' }).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'refused', reasons: [PLAN_REPLACED] });
    fingerprint = 'f2'; // a render or an edit since plan 1
    await settled(startPlan(SONG, 'faster', deps(), { revise: first.id }).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'refused', reasons: [PLAN_STALE] });
    expect(events).toEqual([]);
    expect(getPlan(SONG)).toBe(first);
  });
});

describe('"this" (F-032)', () => {
  it('tells the planner the picked bars and pins the pick on the plan', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(plan(TEMPO));
    await settled(startPlan(SONG, 'make this jazzier', deps(), { referent: CHORUS }).id);
    expect(asks()[0]).toContain('THIS: chorus S3 (chorus #1), bars 47-62. "this", "here" and "it" in the REQUEST mean these bars.\n\nREQUEST: make this jazzier');
    expect(getPlan(SONG)?.referent).toEqual(CHORUS);
  });

  it('plans the whole song without a pick (F-032 #2)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(plan(TEMPO));
    await settled(startPlan(SONG, 'make it jazzier', deps(), { referent: null }).id);
    expect(asks()[0]).not.toContain('THIS:');
    expect(getPlan(SONG)?.referent).toBeNull();
  });

  it('refuses a pick the score no longer has at the turn, with where it is now, and never asks the planner', async () => {
    ollama = await startFakeOllama();
    await settled(startPlan(SONG, 'make this jazzier', deps(), { referent: { ...CHORUS, section: 2, bars: [11, 26] } }).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'refused', reasons: ['the selection is stale: chorus #1 was bars 11-26 and is now bars 47-62'],
      stale: { now: CHORUS } });
    expect(events).toEqual([]);
  });
});
