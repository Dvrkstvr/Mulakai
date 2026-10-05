/** How long a phrase the request asks for, and where it may go (F-026 #1, #2). */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PHRASE_BARS, freeRuns, phraseBarsOf, phraseLines } from './phraseRequest.js';
import type { ScoreFacts } from './planTypes.js';

describe('phraseBarsOf (N bars per request)', () => {
  it.each([
    ['jazz chords in the chorus, 88 BPM, add a 4-bar sax phrase after it', 4],
    ['add a 2 bar tenor sax solo after the verse', 2],
    ['an eight-bar trumpet line in the outro', 8],
    ['a sax phrase of 6 bars after the chorus', 6],
    ['give me three bars of flute melody', 3],
  ])('%s -> %i', (request, n) => expect(phraseBarsOf(request)).toBe(n));

  it(`defaults to ${DEFAULT_PHRASE_BARS} when the request gives no count`, () => {
    expect(DEFAULT_PHRASE_BARS).toBe(4);
    expect(phraseBarsOf('add a sax phrase after the chorus')).toBe(4);
    expect(phraseBarsOf('jazz chords in bars 17-24')).toBe(4);
    expect(phraseBarsOf('jazz chords in the last 8 bars')).toBe(4);
  });

  it('keeps N inside 1-8, what yue-server takes', () => {
    expect(phraseBarsOf('a 16-bar sax solo')).toBe(8);
    expect(phraseBarsOf('a 0-bar sax solo')).toBe(4);
  });
});

const map = ['-- S1 intro --', '(meter M:4/4 from here: one bar = 32 units)',
  '1: - | V:rest | I:0', '2: Dm@1 | V:rest | I:0', '3: Dm@1 | V:rest | I:8', '4: Dm@1 | V:rest | I:8',
  '5: Dm@1 | V:sung | I:8', '6: Dm@1 | V:rest | I:8', '-- S2 outro --', '7: Dm@1 | V:rest | I:0', '8: Dm@1 | V:rest | I:0', '9: Dm@1 | V:rest | I:0'];

describe('freeRuns', () => {
  it('lists runs of at least N bars where the Vocal rests, as yue-server words them', () => {
    expect(freeRuns(map, 4)).toEqual(['1-4', '6-9']);
    expect(freeRuns(map, 5)).toEqual([]);
    expect(freeRuns(map, 1)).toEqual(['1-4', '6-9']);
  });
});

const facts = (barMap: string[]): ScoreFacts => ({
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 9, seconds: 25, units_per_quarter: 8 },
  key_notes: 'D E F G A Bb C', sections: [], lyric_blocks: [], bar_map: barMap,
});

describe('phraseLines', () => {
  it('tells the planner N and the free bars', () => {
    expect(phraseLines(facts(map), 4)).toEqual([
      'PHRASE LENGTH: a WRITE_PHRASE op has exactly 4 bars',
      'FREE BARS (the Vocal rests 4 or more bars in a row; a phrase goes only here): 1-4, 6-9',
    ]);
  });

  it('says so when no N bars in a row are free', () => {
    expect(phraseLines(facts(map), 5)[1]).toBe('FREE BARS (the Vocal rests 5 or more bars in a row; a phrase goes only here): none, no 5 bars in a row are free');
  });
});
