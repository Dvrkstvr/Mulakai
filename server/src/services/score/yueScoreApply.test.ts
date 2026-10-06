/** Replays yue-server's recorded apply replies (D-039): the TS client reads what the real route sends. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { allContracts, contract, startFakeYue, type FakeYue } from '../../../test-fakes/fakeYue.js';
import { applyOps } from './yueScoreApply.js';
import type { Op } from './planTypes.js';

let yue: FakeYue;
beforeAll(async () => { yue = await startFakeYue(); });
afterAll(async () => { await yue.close(); });

const target = () => ({ label: 'YUE2', url: yue.url, apiKey: '' });
const send = (name: string) => {
  const { body } = contract(name).request;
  const lyrics = typeof body.lyrics === 'string' ? body.lyrics : null;
  return applyOps({ abc: body.abc as string, style: body.style as string, lyrics }, body.ops as Op[], target());
};
const fixtures = (prefix: RegExp) => allContracts().map((c) => c.name).filter((n) => prefix.test(n));

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
    await expect(applyOps({ abc: 'not abc', style: '', lyrics: null }, [{ op: 'SET_TEMPO', bpm: 88 }], target()))
      .rejects.toThrow('YUE2 apply score ops -> HTTP 500');
  });
});

describe('the M2 ops against the recorded contract (F-029..F-031)', () => {
  it('serves every section, lyric and transpose fixture as recorded', async () => {
    const names = fixtures(/^apply-(repeat|cut|rewrite-lyrics|transpose)/);
    expect(names.length).toBeGreaterThanOrEqual(16);
    for (const name of names) expect(await send(name)).toEqual(contract(name).response.body);
  });

  it("sends the stored lyrics and reads back the edited ones, the verdict's note and the lyric diff", async () => {
    const repeat = await send('apply-repeat');
    expect(yue.requests.at(-1)?.body).toMatchObject({ lyrics: contract('apply-repeat').request.body.lyrics });
    expect(repeat.changed).toEqual({ abc: true, style: false, lyrics: true });
    expect(repeat.verdicts[0].note).toBe('lyric block 3 [Chorus] is repeated with it; block 5 [Chorus] matches no chorus in the score and stays as it is');
    expect(repeat.sections?.map((s) => `${s.index} ${s.label} ${s.seconds}`))
      .toEqual(['1 intro 27.6', '2 verse 99.3', '3 chorus 44.1', '4 chorus 44.1', '5 outro 8.3']);
    const rewrite = await send('apply-rewrite-lyrics');
    expect(rewrite.verdicts[0].diff).toMatchObject({ block: 5, tag: '[Chorus]', occurrence: 2,
      old: ['chorus 5 line 1', 'chorus 5 line 2', 'chorus 5 line 3', 'chorus 5 line 4'] });
    expect(rewrite.lyrics).toContain('[Chorus]\npaper boats\non a silver tide');
  });

  it('leaves the lyrics key out when none are stored; yue-server refuses a REPEAT then', async () => {
    const out = await send('apply-repeat-no-lyrics');
    expect(yue.requests.at(-1)?.body).not.toHaveProperty('lyrics');
    expect(out.verdicts[0].reason).toMatch(/^the request has no lyrics/);
  });
});
