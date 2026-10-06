import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { cleanStyle, keyWords, rleBarMap } from './songStateText.js';
import type { ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts;

// Expected values are SP-5 prompt.py's own output (rle_bar_map, clean_style with V31, key_words) on the same input.
describe('run-length bar map (SP-5 rle_bar_map)', () => {
  it('a chord-free run collapses to "a-b: ..." (the spike docstring example)', () => {
    const map = Array.from({ length: 7 }, (_, i) => `${i + 1}: - | V:rest | I:0`);
    expect(rleBarMap(map)).toEqual(['1-7: - | V:rest | I:0']);
  });

  it('read-ok: 70 lines -> 59, section and meter lines pass through and break runs', () => {
    const out = rleBarMap(facts.bar_map);
    expect(facts.bar_map).toHaveLength(70);
    expect(out).toHaveLength(59);
    expect(out.slice(0, 14)).toEqual([
      '-- S1 intro --', '(meter M:4/4 from here: one bar = 32 units)', '1: - | V:rest | I:0', '2: Dm@4 | V:rest | I:0',
      '3-4: Dm@1 | V:rest | I:8', '5-6: Bb@1 | V:rest | I:8', '7-8: Dm@1 | V:rest | I:8', '9-10: Bb@1 | V:rest | I:8',
      '-- S2 verse --', '11-12: Dm@1 | V:sung | I:0', '13: Bb@1 | V:sung | I:0', '14: Bb@1 | V:rest | I:3', '15: Dm@1 | V:sung | I:1',
      '16: Dm@1 | V:sung | I:0',
    ]);
  });

  it('a run needs consecutive bar numbers', () => {
    expect(rleBarMap(['1: - | V:rest | I:0', '3: - | V:rest | I:0'])).toEqual(['1: - | V:rest | I:0', '3: - | V:rest | I:0']);
  });
});

describe('STYLE without the app\'s own tempo / key / meter hints (SP-5 clean_style, v3.1)', () => {
  it.each([
    ['german folk, accordion, male voice, 176 bpm, D major, 6/8 time', 'german folk, accordion, male voice'],
    ['synthwave, 120 bpm, B♭ minor, 4/4 time', 'synthwave'],
    ['pop, F#m, 3/4 time, A', 'pop'],
    ['rock, 90bpm, Dm, female voice', 'rock, female voice'],
    ['jazz ballad, piano', 'jazz ballad, piano'],
  ])('%s', (style, want) => {
    expect(cleanStyle(style)).toBe(want);
  });
});

describe('the HEADER key in words (SP-5 key_words, v3.1)', () => {
  it.each([['Fm', ' (F minor)'], ['Bb', ' (Bb major)'], ['F#m', ' (F# minor)'], ['C', ' (C major)']])('%s', (key, want) => {
    expect(keyWords(key)).toBe(want);
  });
});
