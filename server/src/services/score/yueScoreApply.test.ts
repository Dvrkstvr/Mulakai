/** Replays yue-server's recorded apply replies (D-039): the TS client reads what the real route sends. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contract, startFakeYue, type FakeYue } from '../../../test-fakes/fakeYue.js';
import { applyOps } from './yueScoreApply.js';
import type { Op } from './planTypes.js';

let yue: FakeYue;
beforeAll(async () => { yue = await startFakeYue(); });
afterAll(async () => { await yue.close(); });

const target = () => ({ label: 'YUE2', url: yue.url, apiKey: '' });
const send = (name: string) => {
  const { body } = contract(name).request;
  return applyOps(body.abc as string, body.style as string, body.ops as Op[], target());
};

describe('applyOps against the recorded contract', () => {
  it.each(['apply-set-tempo', 'apply-reharmonize', 'apply-edit-style', 'apply-compound', 'apply-slow-cover'])('%s applies', async (name) => {
    const out = await send(name);
    expect(out.ok).toBe(true);
    expect(out).toEqual(contract(name).response.body);
  });

  it('carries the per-op rejection for bar 999', async () => {
    const out = await send('apply-bar-out-of-range');
    expect(out.ok).toBe(false);
    expect(out.verdicts[1]).toEqual({ index: 2, op: 'REHARMONIZE', ok: false, reason: 'bars 999-999 are outside the score (1-65)' });
  });

  it('turns a refused request into an error naming the route', async () => {
    await expect(applyOps('not abc', '', [{ op: 'SET_TEMPO', bpm: 88 }], target())).rejects.toThrow('YUE2 apply score ops -> HTTP 500');
  });
});
