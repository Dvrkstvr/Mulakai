/** POST /api/songs/:id/score/retime: RE-TIME's planner-free plan (RT-4, F-093, D-233). */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { makeScorePlanRouter } from './scorePlan.js';
import { getPlan, resetPlans, setPlan } from '../services/score/planStore.js';
import { RetimePlanRefused, type RetimePlanDeps } from '../services/score/retimePlan.js';
import { RetimeRefused } from '../services/score/yueRetime.js';
import type { Plan } from '../services/score/planTypes.js';

const made: unknown[][] = [];
let behave: 'ok' | 'refused' | 'yue' | 'down' = 'ok';
const PLAN = { id: 'p1', songId: 's1', abc: 'X:1 secret', fingerprint: 'fp', lyrics: 'la', ops: [{ op: 'RETIME', bpm: 47 }] } as unknown as Plan;

// The router's RE-TIME path only calls makeRetimePlan(deps); these deps stand in for its whole chain.
const retimeDeps = (): RetimePlanDeps => ({
  status: async () => { throw new Error('unused'); }, offer: async () => ({ state: 'none' }), load: async () => null,
  retime: async () => { throw new Error('unused'); }, apply: async () => { throw new Error('unused'); },
});

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/songs', makeScorePlanRouter(() => ({}) as never, () => ({
    ...retimeDeps(),
    status: async () => {
      made.push(['status']);
      if (behave === 'refused') throw new RetimePlanRefused(409, 'edited since');
      if (behave === 'yue') throw new RetimeRefused('out_of_range', '300 BPM is outside 40-240');
      if (behave === 'down') throw new Error('YUE2 score retime -> fetch failed');
      return {
        eligibility: { state: 'eligible' },
        source: { songId: 's1', activeVersionId: 'v1', abc: 'X:1', style: 'pop', lyrics: 'la', fingerprint: 'fp' },
        read: { facts: { header: { bars: 4 }, sections: [], lyric_blocks: [] }, chordsPresent: false },
      } as never;
    },
    offer: async () => ({ state: 'offered', notationId: 'c'.repeat(64), readBpm: 120 }),
    load: async () => ({ files: {}, chords: false }),
    retime: async (_b, mode, bpm) => {
      made.push(['retime', mode, bpm]);
      return { abc: 'X:1 re', measures: 2, bpm: mode === 'bpm' ? bpm : 60, readBpm: 120, vocalNotes: 1, insNotes: 0, notes: 4, droppedNotes: 1, leftOut: [], warnings: [] };
    },
    apply: async () => ({
      ok: true, abc: 'X:1 re', style: 'pop', lyrics: 'la', verdicts: [], checks: { ok: true, problems: [], differences: [] },
      changed: { abc: false, style: false }, sections: null, chords_present: false, bpm: 60, seconds: 90, tokens: 900,
    }),
  })));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/songs`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => { resetPlans(); behave = 'ok'; made.length = 0; });

const post = (body: unknown) => fetch(`${base}/s1/score/retime`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/songs/:id/score/retime', () => {
  it('answers the plan at once, never its score, and keeps it as the song\'s pending plan', async () => {
    const res = await post({ mode: 'half' });
    expect(res.status).toBe(200);
    const { plan } = (await res.json()) as { plan: Record<string, unknown> };
    expect(plan).toMatchObject({ songId: 's1', ops: [{ op: 'RETIME', mode: 'half', bpm: 60, from_bpm: 120 }] });
    expect(plan).not.toHaveProperty('abc');
    expect(plan).not.toHaveProperty('fingerprint');
    expect(getPlan('s1')?.id).toBe(plan.id);
  });

  it('sends a rounded BPM in bpm mode only, and refuses a bad request before building anything', async () => {
    await post({ mode: 'bpm', bpm: 91.6 });
    expect(made.at(-1)).toEqual(['retime', 'bpm', 92]);
    for (const body of [{}, { mode: 'triple' }, { mode: 'bpm' }]) expect((await post(body)).status).toBe(400);
  });

  it('passes refusals on with their reason: 409 not offered, 422 yue-server, 502 a failing engine', async () => {
    behave = 'refused';
    expect(await (await post({ mode: 'half' })).json()).toEqual({ error: 'edited since' });
    behave = 'yue';
    const yue = await post({ mode: 'double' });
    expect([yue.status, await yue.json()]).toEqual([422, { error: '300 BPM is outside 40-240', code: 'out_of_range' }]);
    behave = 'down';
    expect((await post({ mode: 'half' })).status).toBe(502);
    expect(getPlan('s1')).toBeUndefined();
  });

  it('a new RE-TIME replaces the pending plan, as a new PLAN does', async () => {
    setPlan({ ...PLAN });
    await post({ mode: 'half' });
    expect(getPlan('s1')?.id).not.toBe('p1');
  });
});
