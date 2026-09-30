import { describe, it, expect } from 'vitest';
import { parseKey, parseMeter, parseTempo, readAbcMeta } from './abcMeta.js';

describe('ABC tempo', () => {
  it.each([
    ['1/4=120', 120],
    ['120', 120],
    ['"Allegro" 1/4=132', 132],
    ['1/4=92.6', 93],
    ['"Andante"', null],
    ['', null],
    [undefined, null],
  ])('Q:%s -> %s', (value, bpm) => {
    expect(parseTempo(value)).toBe(bpm);
  });
});

describe('ABC key', () => {
  it.each([
    ['Am', 'A minor'],
    ['F#min', 'F# minor'],
    ['Bbm', 'Bb minor'],
    ['C', 'C major'],
    ['Cmaj', 'C major'],
    ['Eb', 'Eb major'],
    ['A minor', 'A minor'],
    ['Dm clef=treble', 'D minor'],
    ['D dor', 'D dor'],
    ['Gmix', 'Gmix'],
    ['E phrygian', 'E phrygian'],
    ['none', ''],
    ['HP', ''],
    ['', ''],
  ])('K:%s -> %s', (value, key) => {
    expect(parseKey(value)).toBe(key);
  });
});

describe('ABC meter', () => {
  it.each([
    ['4/4', '4'],
    ['6/8', '6'],
    ['3/4', '3'],
    ['2/4', '2'],
    ['C', '4'],
    ['C|', '2'],
    ['12/8', ''],
    ['none', ''],
    [undefined, ''],
  ])('M:%s -> %s', (value, meter) => {
    expect(parseMeter(value)).toBe(meter);
  });
});

describe('readAbcMeta', () => {
  it('reads the header of a real YuE2 score plan', () => {
    const score = [
      'X:1', 'T:', 'M:4/4', 'L:1/16', 'Q:1/4=84',
      'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"',
      'V: Ins clef=treble name="Ins Melody" snm="Inst."',
      'K:Dm', '% intro', 'V: Vocal', '"Dm7"z16|"Dm7"z16|', 'V: Ins', 'c8z2a3f3|e8c4d4|',
    ].join('\r\n');
    expect(readAbcMeta(score)).toEqual({ bpm: 84, keyScale: 'D minor', timeSignature: '4' });
  });

  it('ignores field lines after the first line of music, like a mid-tune meter change', () => {
    expect(readAbcMeta('X:1\nK:G\n|G2 A2|\nM:3/4\nQ:1/4=60\n'))
      .toEqual({ bpm: null, keyScale: 'G major', timeSignature: '' });
  });

  it('keeps the first of each header field', () => {
    expect(readAbcMeta('M:6/8\nM:4/4\nQ:100\nQ:120\nK:Am\nK:C\n')).toEqual({ bpm: 100, keyScale: 'A minor', timeSignature: '6' });
  });

  it('returns nulls and empties for a missing or empty score', () => {
    const empty = { bpm: null, keyScale: '', timeSignature: '' };
    expect(readAbcMeta(undefined)).toEqual(empty);
    expect(readAbcMeta('')).toEqual(empty);
    expect(readAbcMeta('|A2 B2|\nK:Am\n')).toEqual(empty);
  });
});
