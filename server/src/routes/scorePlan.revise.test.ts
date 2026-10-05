/** POST /score/plan with a pick ("this", F-032) and REVISE (F-033): what is refused before anything is
 * queued, and what GET then shows (the pinned pick, the revision and its marks, the run's revise / stale). */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scoreplan-revise-route-test-'));

const { startFakeOllama } = await import('../../test-fakes/fakeOllama.js');
const { contract, startFakeYue } = await import('../../test-fakes/fakeYue.js');
const { config } = await import('../config.js');
const { getRunning, resetQueue } = await import('../services/genQueue.js');
const { planDeps } = await import('../services/score/planJob.js');
const { resetPlans } = await import('../services/score/planStore.js');
const { NO_PENDING, PLAN_REPLACED, PLAN_STALE } = await import('../services/score/planRevise.js');
const { applyOps } = await import('../services/score/yueScoreApply.js');
const { makeScorePlanRouter } = await import('./scorePlan.js');
type ScoreStatus = import('../services/score/scoreStatus.js').ScoreStatus;

const base = contract('apply-compound').request.body as { abc: string; style: string; lyrics: string };
const eligible = (fingerprint = 'f'): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's1', activeVersionId: 'v1', abc: base.abc, style: base.style, lyrics: base.lyrics, fingerprint } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts: contract('read-ok').response.body.facts as never },
});
let current: ScoreStatus = eligible();
const TEMPO = { content: JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 88 }] }) };
const CHORUS = { kind: 'section', section: 3, label: 'chorus', occurrence: 1, of: 1, bars: [47, 62] };

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
    apply: (b, ops) => applyOps(b, ops, { label: 'YUE2', url: yue.url, apiKey: '' }),
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

afterEach(() => { resetQueue(); resetPlans(); current = eligible(); config.llmUrl = ollama.url; ollama.requests.length = 0; });

const post = (body: unknown) => fetch(`${baseUrl}/s1/score/plan`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const state = async () => (await fetch(`${baseUrl}/s1/score/plan`)).json() as Promise<Record<string, any>>;
async function planned(body: unknown) {
  ollama.chats.splice(0, ollama.chats.length, TEMPO);
  expect((await post(body)).status).toBe(202);
  await vi.waitFor(async () => expect((await state()).run.status).toMatch(/done|failed/), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return state();
}

describe('POST /score/plan with a pick (F-032)', () => {
  it('pins a valid pick on the plan the dock reads (FOR CHORUS 1)', async () => {
    const { plan, run } = await planned({ request: 'make this jazzier', referent: CHORUS });
    expect(plan.referent).toEqual(CHORUS);
    expect(run).toMatchObject({ status: 'done', revise: null, stale: null });
  });

  it('answers a stale pick 409 with where it is now, before anything is queued (Q-043)', async () => {
    const res = await post({ request: 'make this jazzier', referent: { ...CHORUS, section: 4, bars: [63, 70] } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'the selection is stale: chorus #1 was bars 63-70 and is now bars 47-62',
      stale: { picked: { ...CHORUS, section: 4, bars: [63, 70] }, now: CHORUS, reason: 'chorus #1 was bars 63-70 and is now bars 47-62' },
    });
    expect(await state()).toEqual({ run: null, plan: null });
  });

  it('refuses a malformed pick or plan id with 400', async () => {
    expect((await post({ request: 'x', referent: { kind: 'section', section: 3 } })).status).toBe(400);
    expect((await post({ request: 'x', revise: 42 })).status).toBe(400);
  });
});

describe('POST /score/plan with revise (F-033)', () => {
  it('replaces the pending plan with revision 2 and its marks', async () => {
    const first = (await planned({ request: 'set it to 88 BPM' })).plan;
    const { plan, run } = await planned({ request: 'keep it at 88 BPM', revise: first.id, referent: CHORUS });
    expect(plan).toMatchObject({ revision: 2, referent: CHORUS, since: { planId: first.id, marks: [{ mark: 'SAME' }], removed: [] } });
    expect(run).toMatchObject({ status: 'done', revise: first.id, planId: plan.id });
  });

  it('refuses a REVISE with no pending plan, a replaced one, or one made on another score, with 409', async () => {
    let res = await post({ request: 'x', revise: 'p0' });
    expect([res.status, (await res.json()).error]).toEqual([409, NO_PENDING]);
    const first = (await planned({ request: 'set it to 88 BPM' })).plan;
    res = await post({ request: 'x', revise: 'p0' });
    expect([res.status, (await res.json()).error]).toEqual([409, PLAN_REPLACED]);
    current = eligible('f2');
    res = await post({ request: 'x', revise: first.id });
    expect([res.status, (await res.json()).error]).toEqual([409, PLAN_STALE]);
    expect((await state()).plan.id).toBe(first.id);
  });
});
