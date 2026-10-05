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

  it.each(['apply-write-phrase', 'apply-write-phrase-compound', 'apply-write-phrase-beat-sum', 'apply-write-phrase-sanity', 'apply-write-phrase-vocal-sings'])(
    '%s replays as recorded (F-026)', async (name) => {
      expect(await send(name)).toEqual(contract(name).response.body);
    });

  it('carries the instrument appended once to the style, and phrase refusals by number', async () => {
    expect((await send('apply-write-phrase')).style).toBe('dark pop, 90 bpm, F minor, female vocal, tenor saxophone');
    expect((await send('apply-write-phrase-beat-sum')).verdicts[0].reason)
      .toBe('bar 3 of the phrase (score bar 59) sums to 3.5 beats, the meter needs 4 (too short by 0.5)');
  });

  it('turns a refused request into an error naming the route', async () => {
    await expect(applyOps('not abc', '', [{ op: 'SET_TEMPO', bpm: 88 }], target())).rejects.toThrow('YUE2 apply score ops -> HTTP 500');
  });
});
