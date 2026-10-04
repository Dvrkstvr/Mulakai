/** The `plan` job on the real genQueue, against fakeOllama and the recorded yue-server replies. */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-planjob-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { contract, startFakeYue } = await import('../../../test-fakes/fakeYue.js');
const { enqueue, getRunning, getQueued, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { startPlan, planDeps, CHECK_FAILED } = await import('./planJob.js');
const { getPlan, lastRun, resetPlans } = await import('./planStore.js');
const { applyOps } = await import('./yueScoreApply.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type FakeYue = Awaited<ReturnType<typeof startFakeYue>>;
type ScoreStatus = import('./scoreStatus.js').ScoreStatus;

const read = contract('read-ok');
const base = contract('apply-compound').request.body as { abc: string; style: string };
const SONG = 'song-1';
const status = (over: Partial<ScoreStatus> = {}): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: SONG, activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: '', fingerprint: 'l1|v1|v1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: read.response.body.facts as never },
  ...over,
});

const TEMPO = JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 88 }] });
const BAR_999 = JSON.stringify({ ops: [{ op: 'REHARMONIZE', from_bar: 999, to_bar: 999, chords: [{ bar: 999, beat: 1, root: 'G', quality: 'm7' }] }] });

let ollama: FakeOllama;
let yue: FakeYue;
const events: string[] = [];
beforeAll(async () => { yue = await startFakeYue(); });
afterAll(async () => { await yue.close(); });
afterEach(async () => { await ollama?.close(); resetQueue(); resetPlans(); events.length = 0; });

function deps(over: Parameters<typeof planDeps>[0] = {}) {
  const planner = { url: ollama.url, model: 'qwen3:14b' };
  const d = planDeps({ planner, status: async () => status(), apply: (abc, style, ops) => applyOps(abc, style, ops, { label: 'YUE2', url: yue.url, apiKey: '' }), ...over });
  const { ask, release } = d;
  return { ...d, ask: async (...a: Parameters<typeof ask>) => { events.push('ask'); return ask(...a); },
    release: async () => { events.push('unload'); const r = await release(); events.push('empty'); return r; } };
}

const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  return getJob(id)!;
};

describe('plan job (F-019, F-020)', () => {
  it('holds one slot through every attempt and the confirmed unload; a repaint queued meanwhile waits (F-019 #4)', async () => {
    ollama = await startFakeOllama({ listedPolls: 3 });
    ollama.chats.push({ content: BAR_999 }, { content: BAR_999 }, { content: TEMPO });
    const job = startPlan(SONG, 'set it to 88 BPM', deps());
    expect(getRunning()).toMatchObject({ kind: 'plan', jobId: job.id, songId: SONG, label: 'score plan' });
    enqueue({ kind: 'repaint', jobId: crypto.randomUUID() }, () => { events.push(`repaint (ps polls: ${ollama.psPolls().length})`); });
    expect(getQueued().map((q) => q.kind)).toEqual(['repaint']);
    expect((await settled(job.id)).status).toBe('done');
      await vi.waitFor(() => expect(events.at(-1)).toMatch(/^repaint/));
    const polls = ollama.psPolls().length;
    expect(events).toEqual(['ask', 'ask', 'ask', 'unload', 'empty', `repaint (ps polls: ${polls})`]);
    expect(ollama.loaded).toBeNull();
    const plan = getPlan(SONG)!;
    expect(plan).toMatchObject({ songId: SONG, baseVersionId: 'v1', fingerprint: 'l1|v1|v1', attempts: 3, ops: [{ op: 'SET_TEMPO', bpm: 88 }] });
    expect(plan.abc).toContain('Q:1/4=88');
    expect(lastRun(SONG)).toMatchObject({ jobId: job.id, planId: plan.id, reasons: [] });
  });

  it("feeds per-op reasons back and, after 3 attempts, ends in 'check failed' with them, still unloading (F-019 #3)", async () => {
    ollama = await startFakeOllama();
    ollama.chats.push({ content: BAR_999 });
    const job = await settled(startPlan(SONG, 'jazz chords in bar 999', deps()).id);
    expect(job.error).toBe(`${CHECK_FAILED}: op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65); `
      + 'op 1 (REHARMONIZE): to_bar 999 is outside the score (bars 1-65); op 1 (REHARMONIZE): chord bar 999 is outside the score (bars 1-65)');
    const asks = ollama.requests.filter((r) => r.path === '/v1/chat/completions');
    expect(asks).toHaveLength(3);
    expect(JSON.stringify(asks[1].body)).toContain('from_bar 999 is outside the score (bars 1-65)');
    expect(events.slice(-2)).toEqual(['unload', 'empty']);
    expect(lastRun(SONG)?.reasons).toHaveLength(3);
    expect(getPlan(SONG)).toBeUndefined();
  });

  it("sends yue-server's same-root refusal back to the planner word for word (D-055)", async () => {
    const recoloured = contract('apply-reharmonize-same-roots');
    const refusal = (recoloured.response.body.checks as { problems: string[] }).problems[0];
    expect(refusal).toMatch(/^REHARMONIZE 47-54 keeps the old root in 8 of 8 bars; change the root in at least one chord per 2 bars/);
    ollama = await startFakeOllama();
    ollama.chats.push({ content: JSON.stringify({ ops: (recoloured.request.body as { ops: unknown[] }).ops }) }, { content: TEMPO });
    expect((await settled(startPlan(SONG, 'jazz chords in the chorus', deps()).id)).status).toBe('done');
    const asks = ollama.requests.filter((r) => r.path === '/v1/chat/completions');
    const retry = (asks[1].body as { messages: Array<{ role: string; content: string }> }).messages.at(-1)!;
    expect(retry).toEqual({ role: 'user', content: `Your op list was rejected:\n- ${refusal}\nReturn a corrected, complete op list as JSON only.` });
  });

  it('refuses a cut prompt with the F-020 message and shows no plan (F-020 #3)', async () => {
    ollama = await startFakeOllama({ contextLength: 2048 });
    ollama.chats.push({ content: TEMPO, promptTokens: 1027 });
    const job = await settled(startPlan(SONG, 'set it to 88 BPM', deps()).id);
    expect(job.error).toMatch(/^planner context is 2048, needs about \d+: set OLLAMA_CONTEXT_LENGTH=16384$/);
    expect(getPlan(SONG)).toBeUndefined();
    expect(events).toEqual(['ask', 'unload', 'empty']);
  });

  it('ends in an error naming the model when it stays listed, and releases the slot (F-020 #4)', async () => {
    ollama = await startFakeOllama({ neverUnloads: true });
    ollama.chats.push({ content: TEMPO });
    const fast = { url: '', model: 'qwen3:14b' };
    const d = deps();
    const { releasePlanner } = await import('./ollamaControl.js');
    fast.url = ollama.url;
    const job = await settled(startPlan(SONG, 'set it to 88 BPM', { ...d, release: () => releasePlanner(fast, { boundMs: 1000, intervalMs: 100 }) }).id);
    expect(job.error).toMatch(/the planner model qwen3:14b is still loaded after 1 s: run 'ollama stop qwen3:14b'/);
    expect(getPlan(SONG)).toBeUndefined();
      await vi.waitFor(() => expect(getRunning()).toBeNull());
  });

  it('reports a server that is not Ollama as unsupported without planning against it (F-020 #5)', async () => {
    ollama = await startFakeOllama({ notOllama: true });
    const job = await settled(startPlan(SONG, 'set it to 88 BPM', deps()).id);
    expect(job.error).toMatch(/is not an Ollama server \(no \/api\/ps\).*unsupported/);
    expect(ollama.requests.some((r) => r.path === '/v1/chat/completions')).toBe(false);
  });

  it('re-checks eligibility when its turn comes and refuses with the reason, calling no planner', async () => {
    ollama = await startFakeOllama();
    const job = await settled(startPlan(SONG, 'x', deps({ status: async () => status({ eligibility: { state: 'ineligible', reason: 'This song has a repaint version, so score editing ended when it was made.' } }) })).id);
    expect(job.error).toBe('This song has a repaint version, so score editing ended when it was made.');
    expect(ollama.requests).toEqual([]);
  });
});
