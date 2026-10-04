/** GET /api/songs/:id/score (F-018, F-021 #1, F-024 #1) and POST …/score/plan/cancel (F-024 #2). */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-score-route-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { contract } = await import('../../test-fakes/fakeYue.js');
const { config } = await import('../config.js');
const { enqueue, getRunning, resetQueue } = await import('../services/genQueue.js');
const { planDeps } = await import('../services/score/planJob.js');
const { resetPlans } = await import('../services/score/planStore.js');
const { probePlanner } = await import('../services/score/ollamaControl.js');
const { makeScoreRouter } = await import('./score.js');
const { makeScorePlanRouter, NOTHING_TO_CANCEL } = await import('./scorePlan.js');
type ScoreStatus = import('../services/score/scoreStatus.js').ScoreStatus;

const facts = contract('read-ok').response.body.facts as never;
const source = { songId: 's1', activeVersionId: 'v2', abc: 'X:1', style: 'dark pop, 87 bpm', lyrics: '', fingerprint: 'f',
  baseVersions: [{ id: 'v1' }, { id: 'v2' }] } as unknown as ScoreStatus['source'];
const eligible = (): ScoreStatus => ({
  eligibility: { state: 'eligible' }, source,
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts },
});
let current: ScoreStatus = eligible();
const ollama = await startFakeOllama();
let planner = { url: ollama.url, model: 'qwen3:14b' };
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/songs', makeScoreRouter(() => ({ status: async () => current, probe: () => probePlanner(planner) })));
  app.use('/api/songs', makeScorePlanRouter(() => planDeps({ planner, status: async () => current, apply: async () => { throw new Error('unused'); } })));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/songs`;
  config.llmUrl = ollama.url;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); await ollama.close(); });
afterEach(() => { current = eligible(); planner = { url: ollama.url, model: 'qwen3:14b' }; resetQueue(); resetPlans(); });

const get = async () => (await fetch(`${base}/s1/score`)).json() as Promise<Record<string, unknown>>;
const post = (p: string, body?: unknown) => fetch(`${base}/s1/score/${p}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

describe('GET /api/songs/:id/score', () => {
  it('eligible: the reading, the active base version number and the stored style', async () => {
    expect(await get()).toEqual({
      state: 'eligible', reading: { bars: 65, seconds: 179.3, bpm: 87, key: expect.any(String), meter: '4/4', tokens: 1832 },
      baseVersion: 2, versions: 2, style: 'dark pop, 87 bpm',
    });
  });

  it('hidden and ineligible say only that, and never probe the planner', async () => {
    const before = ollama.requests.length;
    current = { ...eligible(), eligibility: { state: 'hidden' } };
    expect(await get()).toEqual({ state: 'hidden' });
    current = { ...eligible(), eligibility: { state: 'ineligible', reason: 'This score has no chords; not supported yet.' } };
    expect(await get()).toEqual({ state: 'ineligible', reason: 'This score has no chords; not supported yet.' });
    expect(ollama.requests.length).toBe(before);
  });

  it('offline: the score checker (yue-server) or the planner, with the cause and its fix', async () => {
    current = { ...eligible(), eligibility: { state: 'offline', reason: 'Score checker unreachable: x. Start yue-server, then RECHECK.' } };
    expect(await get()).toMatchObject({ state: 'offline', offline: 'checker', reason: expect.stringMatching(/^Score checker unreachable/) });
    current = eligible();
    planner = { url: ollama.url, model: 'qwen3:32b' };
    expect(await get()).toMatchObject({ state: 'offline', offline: 'planner', reason: "model qwen3:32b is not on the planner: run 'ollama pull qwen3:32b'", baseVersion: 2 });
    planner = { url: 'http://127.0.0.1:9', model: 'qwen3:14b' };
    expect(await get()).toMatchObject({ state: 'offline', offline: 'planner', reason: expect.stringMatching(/^planner offline/) });
  });
});

describe('POST /api/songs/:id/score/plan/cancel (F-024 #2)', () => {
  it('a queued plan leaves the line; the run reads cancelled', async () => {
    let free!: () => void;
    enqueue({ kind: 'generate', jobId: 'held' }, () => new Promise<void>((r) => { free = r; }));
    expect((await post('plan', { request: 'set it to 88 BPM' })).status).toBe(202);
    expect(await (await post('plan/cancel')).json()).toEqual({ ok: true, cancelled: true });
    const { run } = await (await fetch(`${base}/s1/score/plan`)).json() as { run: Record<string, unknown> };
    expect(run).toMatchObject({ status: 'failed', cancelled: true, cause: 'cancelled', request: 'set it to 88 BPM' });
    free();
  });

  it('a running plan is aborted: cause stays null while the unload holds the slot, then cancelled', async () => {
    ollama.chats.splice(0, ollama.chats.length, { hang: true });
    await post('plan', { request: 'set it to 88 BPM' });
    await vi.waitFor(() => expect(ollama.requests.some((r) => r.path === '/v1/chat/completions')).toBe(true));
    expect(await (await post('plan/cancel')).json()).toEqual({ ok: true, aborted: true });
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    const { run, plan } = await (await fetch(`${base}/s1/score/plan`)).json() as { run: Record<string, unknown>; plan: unknown };
    expect(run).toMatchObject({ status: 'failed', error: 'Aborted', cause: 'cancelled' });
    expect(plan).toBeNull();
  });

  it('404s when nothing is queued or running for the song', async () => {
    const res = await post('plan/cancel');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: NOTHING_TO_CANCEL });
  });
});
