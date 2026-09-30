import { describe, it, expect } from 'vitest';
import { abcFacts, barsOf, keyOf, tempoOf } from './abcFacts';

/** YuE2 / SheetSage2's native two-voice layout, 3 bars. */
const NATIVE = [
  'X:1', 'T:', 'M:4/4', 'L:1/32', 'Q:1/4=88',
  'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"', 'V: Ins clef=treble name="Ins Melody" snm="Inst."', 'K:G',
  '% intro', 'V: Vocal', '"G"z32|', 'V: Ins', 'G8B8d8B8|',
  '% pre-chorus', 'V: Vocal', '"Gmaj7"B8d8"Am7"c8A8|"D7"F16"G"G16|', 'V: Ins', 'z16d16|Z|', '',
].join('\n');

describe('abcFacts', () => {
  it('reads tempo, key and meter from the header, and bars and length from the Vocal voice', () => {
    expect(abcFacts(NATIVE)).toEqual({ bpm: 88, key: 'G major', meter: '4/4', bars: 3, seconds: 8 });
  });

  it('counts multi-bar rests as the bars they stand for, in the Vocal voice only', () => {
    expect(barsOf('M:4/4\nK:C\nV: Vocal\nZ2|C8|\nV: Ins\nZ3|\nV: Vocal\nZ4|\n')).toBe(7);
    expect(barsOf('X:1\nK:C\n')).toBeNull();
  });

  it('parses tempo and key the way the server does', () => {
    expect(tempoOf('1/4=75')).toBe(75);
    expect(tempoOf('"Allegro" 1/4=132')).toBe(132);
    expect(tempoOf('')).toBeNull();
    expect(keyOf('Fm')).toBe('F minor');
    expect(keyOf('F#min')).toBe('F# minor');
    expect(keyOf('Bb')).toBe('Bb major');
    expect(keyOf('D dor')).toBe('D dor');
    expect(keyOf('H')).toBe('');
  });

  it('leaves the length unknown without a tempo or a plain meter', () => {
    expect(abcFacts('M:C\nK:C\nV: Vocal\nC8|\n')).toMatchObject({ bpm: null, meter: 'C', bars: 1, seconds: null });
  });
});
