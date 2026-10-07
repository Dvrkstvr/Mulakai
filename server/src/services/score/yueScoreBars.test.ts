/** `POST /v1/scores/bars` against fakeYue's replay of CL-2's recorded replies (D-039, D-174). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contract, startFakeYue, type FakeYue } from '../../../test-fakes/fakeYue.js';
import { scoreBars } from './yueScoreBars.js';

let fake: FakeYue;
const target = () => ({ label: 'YUE2', url: fake.url, apiKey: 'k' });
const body = (name: string) => contract(name).request.body as { abc: string; grid: unknown };

beforeAll(async () => { fake = await startFakeYue(); });
afterAll(async () => { await fake.close(); });

describe('scoreBars', () => {
  it('times each score bar on the grid with the source the caller names', async () => {
    const { abc, grid } = body('scores-bars-ok');
    const out = await scoreBars(target(), abc, grid, 'cached');
    const rec = contract('scores-bars-ok').response.body;
    expect(out).toEqual({ ok: true, bars: { source: 'cached', offset: rec.offset, starts: rec.starts, end: rec.end, agreement: rec.agreement } });
    expect(fake.requests.at(-1)).toMatchObject({ method: 'POST', path: '/v1/scores/bars', body: { abc, grid } });
  });

  it('keeps a pickup fit (offset) as yue-server recorded it', async () => {
    const { abc, grid } = body('scores-bars-pickup');
    const out = await scoreBars(target(), abc, grid, 'tracked');
    expect(out.ok && out.bars.offset).toBe(contract('scores-bars-pickup').response.body.offset);
  });

  it.each([['scores-bars-bad-grid', 'not a grid_v 1 grid'], ['scores-bars-bad-score', 'not a native two-voice score']])(
    '%s is a reason with yue-server\'s message, not a throw', async (name, words) => {
      const { abc, grid } = body(name);
      const out = await scoreBars(target(), abc, grid, 'cached');
      expect(out.ok).toBe(false);
      expect(!out.ok && out.reason).toContain(`YUE2 could not time the bars: ${words}`);
    });

  it('a string detail is a reason too; an unreachable server throws', async () => {
    const out = await scoreBars(target(), 'X:1\nnot recorded\n', { grid_v: 1 }, 'cached');
    expect(out).toEqual({ ok: false, reason: 'YUE2 could not time the bars: fakeYue: no recorded reply for POST /v1/scores/bars' });
    await expect(scoreBars({ label: 'YUE2', url: 'http://127.0.0.1:9', apiKey: '' }, 'X', {}, 'cached')).rejects.toThrow('YUE2 bar times');
  });
});
