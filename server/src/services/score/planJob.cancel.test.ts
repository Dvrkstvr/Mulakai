/** The `plan` job's endings for the dock (F-022, F-024): CANCEL mid-plan, the review's limits, and
 * the cause each failed run is filed under. Real genQueue, fakeOllama, recorded yue-server facts. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-planjob-cancel-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { enqueue, getRunning, resetQueue } = await import('../genQueue.js');
const { abortJob, getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps } = await import('./planJob.js');
const { getPlan, lastRun, resetPlans } = await import('./planStore.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;
type ApplyResult = import('./planTypes.js').ApplyResult;

const read = contract('read-ok');
const base = contract('apply-compound').request.body as { abc: string; style: string; lyrics: string };
const SONG = 'song-1';
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: base.lyrics, fingerprint: 'f' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 145, seconds: 278, tokens: 1832, facts: read.response.body.facts as never },
});
const TEMPO = JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 88 }] });
const applied = (over: Partial<ApplyResult> = {}): ApplyResult => ({
  ok: true, abc: base.abc, style: base.style, verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }],
  checks: { ok: true, problems: [], differences: [] }, changed: { abc: true, style: true },
  chords_present: true, bpm: 88, seconds: 183, tokens: 1520, ...over,
});

let ollama: FakeOllama;
const events: string[] = [];
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); events.length = 0; });

function deps(over: Parameters<typeof planDeps>[0] = {}) {
  const d = planDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, status: async () => status(), apply: async () => applied(), ...over });
  const { release } = d;
  return { ...d, release: async () => { events.push('unload'); const r = await release(); events.push('empty'); return r; } };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  return getJob(id)!;
};

describe('CANCEL while planning (F-024 #2)', () => {
  it('aborts the planner call at once, still unloads and confirms, then frees the slot; no plan, cause cancelled', async () => {
    ollama = await startFakeOllama({ listedPolls: 2 });
    ollama.chats.push({ hang: true });
    const job = startPlan(SONG, 'set it to 88 BPM', deps());
    enqueue({ kind: 'repaint', jobId: crypto.randomUUID() }, () => { events.push('repaint'); });
    await vi.waitFor(() => expect(ollama.requests.some((r) => r.path === '/v1/chat/completions')).toBe(true));
    ollama.loaded = 'qwen3:14b'; // the model is on the GPU while it thinks
    expect(abortJob(job.id)).toBe(true);
    expect((await settled(job.id)).error).toBe('Aborted');
    await vi.waitFor(() => expect(events.at(-1)).toBe('repaint'));
    expect(events).toEqual(['unload', 'empty', 'repaint']);
    expect(ollama.loaded).toBeNull();
    expect(getPlan(SONG)).toBeUndefined();
    expect(lastRun(SONG)).toMatchObject({ jobId: job.id, cause: 'cancelled', planId: null });
  });

  it('a cancelled re-plan drops the plan it would have replaced', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ content: TEMPO });
    await settled(startPlan(SONG, 'set it to 88 BPM', deps()).id);
    expect(getPlan(SONG)).toBeDefined();
    ollama.chats.splice(0, 1, { hang: true });
    const again = startPlan(SONG, 'now 90 BPM', deps());
    await vi.waitFor(() => expect(ollama.requests.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(2));
    abortJob(again.id);
    await settled(again.id); // failed at once; the body settles after the unload
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    expect(getPlan(SONG)).toBeUndefined();
  });
});

describe('review limits inside the retry loop (F-022)', () => {
  it('feeds an over-long plan back and ends in check failed with the number and the tempo that fits', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ content: TEMPO });
    const job = await settled(startPlan(SONG, 'set it to 88 BPM', deps({ apply: async () => applied({ seconds: 458 }) })).id);
    expect(job.status).toBe('failed');
    expect(ollama.requests.filter((r) => r.path === '/v1/chat/completions')).toHaveLength(3);
    expect(lastRun(SONG)).toMatchObject({ cause: 'check', reasons: ['estimated 458 s: over the 360 s limit; at least 112 BPM fits'] });
    expect(getPlan(SONG)).toBeUndefined();
  });

  it("refuses a plan that changes nothing: 'this request did not change the score, the style or the lyrics'", async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ content: TEMPO });
    await settled(startPlan(SONG, 'make it sadder', deps({ apply: async () => applied({ changed: { abc: false, style: false } }) })).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'check', reasons: ['this request did not change the score, the style or the lyrics'] });
  });
});

describe('the cause a failed run is filed under (the dock state it maps to)', () => {
  it('offline: the planner is gone, and the slot is free again', async () => {
    ollama = await startFakeOllama();
    const url = ollama.url;
    await ollama.close();
    const job = await settled(startPlan(SONG, 'x', planDeps({ planner: { url, model: 'qwen3:14b' }, status: async () => status() })).id);
    expect(job.error).toMatch(/^planner offline/);
    expect(lastRun(SONG)).toMatchObject({ cause: 'offline', reasons: [job.error] });
    expect(getRunning()).toBeNull();
  });

  it('offline: the model is not pulled, naming the fix', async () => {
    ollama = await startFakeOllama({ models: ['llama3:8b'] });
    await settled(startPlan(SONG, 'x', deps()).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'offline', reasons: ["model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'"] });
  });

  it('refused: the song stopped being eligible while the plan waited', async () => {
    ollama = await startFakeOllama();
    const reason = 'This song has 2 layers; a re-render would drop the extra one.';
    await settled(startPlan(SONG, 'x', deps({ status: async () => ({ ...status(), eligibility: { state: 'ineligible', reason } }) })).id);
    expect(lastRun(SONG)).toMatchObject({ cause: 'refused', reasons: [reason] });
  });

  it('check: a cut prompt', async () => {
    ollama = await startFakeOllama({ contextLength: 2048 });
    ollama.chats.push({ content: TEMPO, promptTokens: 1027 });
    await settled(startPlan(SONG, 'x', deps()).id);
    expect(lastRun(SONG)?.cause).toBe('check');
  });
});
