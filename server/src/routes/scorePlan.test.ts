import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scoreplan-route-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { contract, startFakeYue } = await import('../../test-fakes/fakeYue.js');
const { config } = await import('../config.js');
const { enqueue, resetQueue } = await import('../services/genQueue.js');
const { planDeps } = await import('../services/score/planJob.js');
const { resetPlans } = await import('../services/score/planStore.js');
const { applyOps } = await import('../services/score/yueScoreApply.js');
const { makeScorePlanRouter, ALREADY_PLANNING, NOT_SET_UP } = await import('./scorePlan.js');
type ScoreStatus = import('../services/score/scoreStatus.js').ScoreStatus;

const base = contract('apply-compound').request.body as { abc: string; style: string };
const eligible = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's1', activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: '', fingerprint: 'f' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: contract('read-ok').response.body.facts as never },
});
let current: ScoreStatus = eligible();

const ollama = await startFakeOllama();
const yue = await startFakeYue();
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/songs', makeScorePlanRouter(() => planDeps({
    planner: { url: ollama.url, model: 'qwen3:14b' },
    status: async () => current,
    apply: (abc, style, ops) => applyOps(abc, style, ops, { label: 'YUE2', url: yue.url, apiKey: '' }),
  })));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/songs`;
  config.llmUrl = ollama.url;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await ollama.close();
  await yue.close();
});

afterEach(() => { resetQueue(); resetPlans(); current = eligible(); config.llmUrl = ollama.url; });

const post = (body: unknown) => fetch(`${baseUrl}/s1/score/plan`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const state = async () => (await fetch(`${baseUrl}/s1/score/plan`)).json() as Promise<Record<string, any>>;

describe('POST /api/songs/:id/score/plan', () => {
  it('starts a plan job and GET returns its run and the plan, without the edited score', async () => {
    ollama.chats.splice(0, ollama.chats.length, { content: JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 88 }] }) });
    const res = await post({ request: 'set it to 88 BPM' });
    expect(res.status).toBe(202);
    const { jobId, queuePosition } = await res.json() as { jobId: string; queuePosition: number };
    expect(queuePosition).toBe(0);
    await vi.waitFor(async () => expect((await state()).run.status).toBe('done'), { timeout: 5000 });
    const body = await state();
    expect(body.run).toMatchObject({ jobId, request: 'set it to 88 BPM', status: 'done', reasons: [], planId: body.plan.id });
    expect(body.plan).toMatchObject({ songId: 's1', baseVersionId: 'v1', attempts: 1, refusals: [], ops: [{ op: 'SET_TEMPO', bpm: 88 }],
      style: 'dark pop, 88 bpm, F minor, female vocal', checks: { bars: 65, seconds: 177.3, tokens: 1832, chordsPresent: true } });
    expect(body.plan.abc).toBeUndefined();
    expect(body.plan.fingerprint).toBeUndefined();
  });

  it('refuses a second plan for the song while one is queued', async () => {
    let free!: () => void;
    enqueue({ kind: 'generate', jobId: 'held' }, () => new Promise<void>((r) => { free = r; }));
    const first = await post({ request: 'set it to 88 BPM' });
    expect(await first.json()).toMatchObject({ queuePosition: 1 });
    expect((await state()).run).toMatchObject({ status: 'queued', queuePosition: 1 });
    const second = await post({ request: 'again' });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: ALREADY_PLANNING });
    free();
  });

  it('names why a song cannot be planned', async () => {
    current = { ...eligible(), eligibility: { state: 'ineligible', reason: 'This song has 2 layers; a re-render would drop the extra one.' } };
    const res = await post({ request: 'x' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'This song has 2 layers; a re-render would drop the extra one.' });
    current = { ...eligible(), source: null };
    expect((await post({ request: 'x' })).status).toBe(404);
  });

  it('refuses an empty or long request, and a server with no planner', async () => {
    expect((await post({ request: '  ' })).status).toBe(400);
    expect((await post({ request: 'x'.repeat(501) })).status).toBe(400);
    config.llmUrl = '';
    const res = await post({ request: 'x' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: NOT_SET_UP });
  });

  it('GET answers nulls for a song never planned', async () => {
    expect(await (await fetch(`${baseUrl}/other/score/plan`)).json()).toEqual({ run: null, plan: null });
  });
});
