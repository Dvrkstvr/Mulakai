import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { cutHint, limitReasons, minBpmThatFits, readNumbers, withLimits, NO_CHANGE, LIMIT_SECONDS, TOKEN_LIMIT } from './scoreLimits.js';
import type { ApplyResult, Op, ScoreFacts } from './planTypes.js';

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

  it('refuses a plan that changes neither the score, the style nor the lyrics', () => {
    expect(limitReasons({ seconds: 183, bpm: 88, tokens: 1520, changed: { abc: false, style: false } })).toEqual([NO_CHANGE]);
    expect(limitReasons({ seconds: 183, bpm: 88, tokens: 1520, changed: { abc: false, style: false, lyrics: false } })).toEqual([NO_CHANGE]);
    expect(NO_CHANGE).toBe('this request did not change the score, the style or the lyrics');
  });

  it('passes a plan that only rewrites lyrics (F-031): the render sends the new words', () => {
    expect(limitReasons({ seconds: 183, bpm: 88, tokens: 1520, changed: { abc: false, style: false, lyrics: true } })).toEqual([]);
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

const sections = (contract('read-sections').response.body.facts as ScoreFacts).sections; // 1 intro, 2 verse, 3 chorus, 4 outro
const sec = (index: number, label: string, seconds: number) => ({ index, label, from_bar: 1, to_bar: 1, seconds });
const ok = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i + 1, op: 'X', ok: true, reason: null }));

describe('the cut hint (F-030 #2)', () => {
  it('names the smallest section whose cut fits a repeat over 360 s, by its read number, beside the tempo that fits', () => {
    const fixture = contract('apply-repeat-over-limit');
    const result = fixture.response.body as unknown as ApplyResult; // SET_TEMPO 66 + REPEAT verse: 367.3 s
    const ops = fixture.request.body.ops as Op[];
    expect(cutHint(sections, ops, result)).toEqual({ section: 4, label: 'outro', seconds: 10.9 }); // edited S5
    expect(withLimits(result, { ops, sections }).checks.problems)
      .toEqual(['estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least 68 BPM fits']);
  });

  it('maps the edited numbering back past a CUT and a REPEAT, and never offers the repeated section', () => {
    const ops: Op[] = [{ op: 'CUT', section: 1, label: 'intro' }, { op: 'REPEAT', section: 3, label: 'chorus' }];
    const result = applied({ verdicts: ok(2), seconds: 400, bpm: 90,
      sections: [sec(1, 'verse', 50), sec(2, 'chorus', 45), sec(3, 'chorus', 45), sec(4, 'outro', 30)] });
    expect(readNumbers(sections, ops, result)).toEqual([
      { read: 2, copy: false }, { read: 3, copy: false }, { read: 3, copy: true }, { read: 4, copy: false }]);
    expect(cutHint(sections, ops, result)).toEqual({ section: 2, label: 'verse', seconds: 50 });
  });

  it('gives no hint without an applied REPEAT, when no one cut fits, or when the sections do not add up', () => {
    const repeat: Op[] = [{ op: 'REPEAT', section: 2, label: 'verse' }];
    const five = [sec(1, 'intro', 20), sec(2, 'verse', 100), sec(3, 'verse', 100), sec(4, 'chorus', 30), sec(5, 'outro', 10)];
    expect(cutHint(sections, [{ op: 'SET_TEMPO', bpm: 60 }], applied({ seconds: 400, sections: five }))).toBeNull();
    expect(cutHint(sections, repeat, applied({ verdicts: [{ index: 1, op: 'REPEAT', ok: false, reason: 'no' }], seconds: 400, sections: five }))).toBeNull();
    expect(cutHint(sections, repeat, applied({ seconds: 400, sections: five }))).toBeNull(); // the chorus saves 30 s: 370 s
    expect(cutHint(sections, repeat, applied({ seconds: 370, sections: five.slice(1) }))).toBeNull();
    expect(withLimits(applied({ seconds: 400, bpm: 90, sections: five }), { ops: repeat, sections }).checks.problems)
      .toEqual(['estimated 400 s: over the 360 s limit; at least 101 BPM fits']);
  });
});
