import { describe, it, expect } from 'vitest';
import { limitReasons, minBpmThatFits, withLimits, NO_CHANGE, LIMIT_SECONDS, TOKEN_LIMIT } from './scoreLimits.js';
import type { ApplyResult } from './planTypes.js';

const applied = (over: Partial<ApplyResult> = {}): ApplyResult => ({
  ok: true, abc: 'X:1', style: 'pop', verdicts: [{ index: 0, op: 'SET_TEMPO', ok: true, reason: null }],
  checks: { ok: true, problems: [], differences: [] }, changed: { abc: true, style: false },
  chords_present: true, bpm: 88, seconds: 183, tokens: 1520, ...over,
});

describe('scoreLimits (F-022)', () => {
  it('passes a plan inside every limit', () => {
    expect(limitReasons({ seconds: 183, bpm: 88, tokens: 1520, changed: { abc: true, style: false } })).toEqual([]);
    expect(limitReasons({ seconds: 359.9, bpm: 88, tokens: TOKEN_LIMIT, changed: { abc: false, style: true } })).toEqual([]);
  });

  it('refuses 360 s or more with the number and the slowest tempo that fits (the 145 BPM cover at 88)', () => {
    expect(minBpmThatFits(458, 88)).toBe(112);
    expect(limitReasons({ seconds: 458, bpm: 88, tokens: 1520, changed: { abc: true, style: false } }))
      .toEqual(['estimated 458 s: over the 360 s limit; at least 112 BPM fits']);
    // exactly at the limit is refused too, and the tempo named must bring it under
    expect(limitReasons({ seconds: LIMIT_SECONDS, bpm: 90, tokens: 1, changed: { abc: true, style: false } }))
      .toEqual(['estimated 360 s: over the 360 s limit; at least 91 BPM fits']);
  });

  it('refuses more than 4,096 tokens, counted with chords kept, by how many', () => {
    expect(limitReasons({ seconds: 200, bpm: 88, tokens: 6000, changed: { abc: true, style: false } }))
      .toEqual(['1,904 tokens over the 4,096 limit']);
  });

  it('refuses a plan that changes neither the score nor the style', () => {
    expect(limitReasons({ seconds: 183, bpm: 88, tokens: 1520, changed: { abc: false, style: false } })).toEqual([NO_CHANGE]);
  });

  it('turns an applied plan over a limit into a rejected one, so the planner hears the number', () => {
    const out = withLimits(applied({ seconds: 458 }));
    expect(out.ok).toBe(false);
    expect(out.checks.problems).toEqual(['estimated 458 s: over the 360 s limit; at least 112 BPM fits']);
    expect(withLimits(applied())).toEqual(applied());
  });

  it('does not add "did not change" when an op was refused: the refusal already says why (F-026 retry)', () => {
    const refused = applied({ ok: false, changed: { abc: false, style: false },
      verdicts: [{ index: 1, op: 'WRITE_PHRASE', ok: false, reason: 'the Vocal sings in bars 11-12; free: 1-10, 47-65' }] });
    expect(withLimits(refused).checks.problems).toEqual([]);
    expect(withLimits(applied({ changed: { abc: false, style: false } })).checks.problems).toEqual([NO_CHANGE]);
  });

  it('leaves unknown seconds or tokens unjudged (the tokenizer may still be loading)', () => {
    expect(limitReasons({ seconds: null, bpm: null, tokens: null, changed: { abc: true, style: false } })).toEqual([]);
  });
});
