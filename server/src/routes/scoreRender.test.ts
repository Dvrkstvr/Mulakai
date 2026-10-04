/** POST/GET /api/songs/:id/score/render and its cancel (F-023 #3, #6; F-024 #4): every click-time
 * refusal is a 409 naming its reason, and none of them reaches yue-server. A plan refusal is
 * `stale: true`; a GPU refusal is not (the plan is fine, D-054). */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-score-render-route-test-'));

const { startFakeYue } = await import('../../test-fakes/fakeYue.js');
const { enqueue, resetQueue } = await import('../services/genQueue.js');
const { resetPlans, setPlan } = await import('../services/score/planStore.js');
const { renderDeps } = await import('../services/score/scoreRenderJob.js');
const { CHANGED_SINCE_PLAN } = await import('../services/score/scoreEligibility.js');
const { PLAN_EXPIRED, editQueued, plannerLoaded, plannerUnconfirmed } = await import('../services/score/scoreLimits.js');
const { makeScoreRenderRouter, ALREADY_RENDERING, NOTHING_TO_CANCEL } = await import('./scoreRender.js');
type ScoreStatus = import('../services/score/scoreStatus.js').ScoreStatus;
type Plan = import('../services/score/planTypes.js').Plan;
type LoadedModel = import('../services/score/ollamaControl.js').LoadedModel;

const source = { songId: 's1', activeVersionId: 'v1', fingerprint: 'L|v1|v1', seed: 831, lyrics: '[Verse]\nla\n' } as ScoreStatus['source'];
let current: ScoreStatus;
let loaded: LoadedModel[] = [];
let psDown: string | null = null;
const yue = await startFakeYue([]);
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/songs', makeScoreRenderRouter(() => renderDeps({
    target: { label: 'YUE2', url: yue.url, apiKey: '' }, status: async () => current,
    loaded: async () => { if (psDown) throw new Error(psDown); return loaded; },
  })));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); await yue.close(); });
afterEach(() => {
  resetQueue(); resetPlans(); loaded = []; psDown = null; yue.requests.length = 0;
  current = { eligibility: { state: 'eligible' }, source, read: null };
});

const plan = { id: 'p1', songId: 's1', fingerprint: 'L|v1|v1', abc: 'X:1', style: 's', ops: [] } as unknown as Plan;
const render = (planId = 'p1') => fetch(`${base}/api/songs/s1/score/render`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }),
});
const state = async () => (await (await fetch(`${base}/api/songs/s1/score/render`)).json()) as { run: Record<string, unknown> | null };
const hold = () => enqueue({ kind: 'repaint', jobId: 'hold', songId: 'other' }, () => new Promise(() => {}));

describe('POST /api/songs/:id/score/render refusals (re-checked at the click)', () => {
  it.each<[string, () => void, string]>([
    ['the song lost eligibility', () => { current = { ...current, eligibility: { state: 'ineligible', reason: 'This song has 2 layers; a re-render would drop the extra one.' } }; },
      'This song has 2 layers; a re-render would drop the extra one.'],
    ['the plan expired', () => { resetPlans(); }, PLAN_EXPIRED],
    ['the base version changed', () => { current = { ...current, source: { ...source!, fingerprint: 'L|v1,v2|v2' } }; }, CHANGED_SINCE_PLAN],
    ['a repaint was queued after the plan', () => { hold(); enqueue({ kind: 'repaint', jobId: 'r', songId: 's1', label: 'repaint 1:32–2:07' }, () => {}); },
      editQueued('repaint 1:32–2:07')],
  ])('%s: 409 stale with the reason, no engine job', async (_name, arrange, reason) => {
    current = { eligibility: { state: 'eligible' }, source, read: null };
    setPlan(plan);
    arrange();
    const res = await render();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: reason, stale: true });
    expect(yue.submits()).toEqual([]);
    expect((await state()).run).toBeNull();
  });

  it.each<[string, () => void, string]>([
    ['/api/ps still lists the planner', () => { loaded = [{ name: 'qwen3:14b', contextLength: 16384 }]; }, plannerLoaded(['qwen3:14b'])],
    ['the planner is stopped (/api/ps unreadable)', () => { psDown = 'planner http://x/api/ps -> fetch failed'; },
      plannerUnconfirmed('planner http://x/api/ps -> fetch failed')],
  ])('%s: 409 with the reason but not stale (the plan is fine, D-054), no engine job', async (_name, arrange, reason) => {
    setPlan(plan);
    arrange();
    const res = await render();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: reason });
    expect(yue.submits()).toEqual([]);
    expect((await state()).run).toBeNull();
  });

  it('needs a plan id', async () => {
    const res = await fetch(`${base}/api/songs/s1/score/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(400);
  });
});

describe('a queued render: state, second click, cancel', () => {
  it('202 behind a busy slot, reads queued, refuses a second render, and CANCEL takes it out of line', async () => {
    current = { eligibility: { state: 'eligible' }, source, read: null };
    setPlan(plan);
    hold();
    const res = await render();
    expect(res.status).toBe(202);
    const { jobId, queuePosition } = await res.json() as { jobId: string; queuePosition: number };
    expect(queuePosition).toBe(1);
    expect((await state()).run).toMatchObject({ jobId, planId: 'p1', status: 'queued', queuePosition: 1, cause: null, version: null });
    const again = await render();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: ALREADY_RENDERING, jobId });
    const cancel = await fetch(`${base}/api/songs/s1/score/render/cancel`, { method: 'POST' });
    expect(await cancel.json()).toEqual({ ok: true, cancelled: true });
    expect((await state()).run).toMatchObject({ status: 'failed', cause: 'cancelled' });
    expect(yue.submits()).toEqual([]);
    expect((await fetch(`${base}/api/songs/s1/score/render/cancel`, { method: 'POST' })).status).toBe(404);
  });

  it('cancel with nothing in flight says so', async () => {
    const res = await fetch(`${base}/api/songs/s1/score/render/cancel`, { method: 'POST' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: NOTHING_TO_CANCEL });
  });
});
