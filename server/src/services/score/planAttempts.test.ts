import { describe, it, expect, vi } from 'vitest';
import { planAttempts, MAX_ATTEMPTS } from './planAttempts.js';
import type { ApplyResult, ChatMessage, ScoreFacts } from './planTypes.js';

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 65, seconds: 179.3, units_per_quarter: 8 },
  key_notes: '', sections: [], lyric_blocks: [], bar_map: [],
};
const start: ChatMessage[] = [{ role: 'system', content: 'rules' }, { role: 'user', content: 'song' }];

const BAR_999 = JSON.stringify({ ops: [{ op: 'REHARMONIZE', from_bar: 999, to_bar: 999, chords: [{ bar: 999, beat: 1, root: 'G', quality: 'm7' }] }] });
const TEMPO = JSON.stringify({ ops: [{ op: 'SET_TEMPO', bpm: 88 }] });

const applied = (over: Partial<ApplyResult> = {}): ApplyResult => ({
  ok: true, abc: 'X:1', style: 's', verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }],
  checks: { ok: true, problems: [], differences: [] }, changed: { abc: true, style: true },
  chords_present: true, bpm: 88, seconds: 177.3, tokens: 1832, ...over,
});

const stub = (...replies: string[]) => vi.fn(async (_m: ChatMessage[]) => ({ content: replies.shift() ?? TEMPO, promptTokens: 2000 }));

describe('planAttempts (F-019 #3)', () => {
  it('stops at the first valid plan', async () => {
    const ask = stub(TEMPO);
    const apply = vi.fn(async () => applied());
    const out = await planAttempts(facts, start, { ask, apply });
    expect(out).toMatchObject({ ok: true, attempts: 1, ops: [{ op: 'SET_TEMPO', bpm: 88 }] });
    expect(apply).toHaveBeenCalledWith([{ op: 'SET_TEMPO', bpm: 88 }]);
  });

  it('feeds the per-op reason back and succeeds on the next attempt', async () => {
    const ask = stub(BAR_999, TEMPO);
    const onAttempt = vi.fn();
    const out = await planAttempts(facts, start, { ask, apply: async () => applied(), onAttempt });
    expect(out).toMatchObject({ ok: true, attempts: 2 });
    const second = ask.mock.calls[1][0];
    expect(second.slice(0, 2)).toEqual(start);
    expect(second[2]).toEqual({ role: 'assistant', content: BAR_999 });
    expect(second[3].content).toContain('- op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)');
    expect(onAttempt.mock.calls).toEqual([[1, undefined], [2, 'op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)']]);
  });

  it(`ends in 'check failed' with the reasons after ${MAX_ATTEMPTS} rejected attempts`, async () => {
    const ask = stub(BAR_999, BAR_999, BAR_999, TEMPO);
    const apply = vi.fn(async () => applied());
    const out = await planAttempts(facts, start, { ask, apply });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(apply).not.toHaveBeenCalled();
    expect(out).toEqual({
      ok: false, attempts: 3, reasons: [
        'op 1 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)',
        'op 1 (REHARMONIZE): to_bar 999 is outside the score (bars 1-65)',
        'op 1 (REHARMONIZE): chord bar 999 is outside the score (bars 1-65)',
      ],
    });
  });

  it("feeds back yue-server's per-op verdicts and checks", async () => {
    const ask = stub(TEMPO, TEMPO, TEMPO);
    const rejected = applied({
      ok: false,
      verdicts: [{ index: 1, op: 'REHARMONIZE', ok: false, reason: 'bars 999-999 are outside the score (1-65)' }],
      checks: { ok: false, problems: ['chords changed outside the REHARMONIZE bars: 3'], differences: ['Vocal bar 4 differs'] },
    });
    const out = await planAttempts(facts, start, { ask, apply: async () => rejected });
    expect(out).toEqual({
      ok: false, attempts: 3, reasons: [
        'op 1 (REHARMONIZE): bars 999-999 are outside the score (1-65)',
        'chords changed outside the REHARMONIZE bars: 3',
        'Vocal bar 4 differs',
      ],
    });
  });

  it('checks a phrase against the N bars the request asked for (F-026)', async () => {
    const bar = [{ pitch: 'D', beats: 4 }];
    const two = JSON.stringify({ ops: [{ op: 'WRITE_PHRASE', start_bar: 57, instrument: 'sax', bars: [bar, bar] }] });
    const apply = vi.fn(async () => applied());
    expect(await planAttempts(facts, start, { ask: stub(two), apply }, { phraseBars: 2 })).toMatchObject({ ok: true, attempts: 1 });
    const out = await planAttempts(facts, start, { ask: stub(two, two, two), apply }, { maxAttempts: 2 });
    expect(out).toEqual({ ok: false, attempts: 2, reasons: ['op 1 (WRITE_PHRASE): the phrase has 2 bars; the request asks for 4'] });
  });

  it('treats a reply that is not JSON as a rejected attempt', async () => {
    const out = await planAttempts(facts, start, { ask: stub('sure! here', TEMPO), apply: async () => applied() });
    expect(out).toMatchObject({ ok: true, attempts: 2 });
  });

  it('lets a planner error end the loop at once', async () => {
    const ask = vi.fn(async () => { throw new Error('planner context is 2048, needs about 7500'); });
    await expect(planAttempts(facts, start, { ask, apply: async () => applied() })).rejects.toThrow('planner context is 2048');
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
