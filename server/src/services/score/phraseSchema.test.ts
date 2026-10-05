/** WRITE_PHRASE's shape (F-026 #1): notes, never ABC; N bars set per request; yue-server's bounds. */
import { describe, it, expect } from 'vitest';
import { BEATS, PITCH, phraseOpSchema, phraseProblems } from './phraseSchema.js';

const note = (pitch: string, beats: number) => ({ pitch, beats });
const bar = [note('D', 1), note('F', 0.5), note('A', 0.5), note('d', 2)];
const phrase = (over: Record<string, unknown> = {}) => ({ op: 'WRITE_PHRASE', start_bar: 57, instrument: 'tenor saxophone', bars: [bar, bar, bar, bar], ...over });

describe('PITCH and BEATS match yue-server (score_phrase.py)', () => {
  it('keeps the exact pattern and the six lengths', () => {
    expect(PITCH).toBe("^(?:z|(?:\\^|_|=)?[A-Ga-g](?:,{1,2}|'{1,2})?)$");
    expect(BEATS).toEqual([0.5, 1, 1.5, 2, 3, 4]);
  });

  it.each(['z', 'C', 'c', '^F', '_B', '=e', 'C,', 'C,,', "c'", "c''"])('accepts %s', (p) => expect(new RegExp(PITCH).test(p)).toBe(true));
  it.each(['H', 'C3', "C,'", '^^F', 'D4', 'z2', '', 'CD'])('refuses %s', (p) => expect(new RegExp(PITCH).test(p)).toBe(false));
});

describe('phraseOpSchema', () => {
  it('has exactly N bars of 1-16 notes {pitch, beats}, nothing extra', () => {
    const s = phraseOpSchema(65, 4) as Record<string, any>;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['op', 'start_bar', 'instrument', 'bars']);
    expect(s.properties.op).toEqual({ const: 'WRITE_PHRASE' });
    expect(s.properties.instrument).toEqual({ type: 'string', minLength: 1, maxLength: 40 });
    expect(s.properties.bars).toMatchObject({ type: 'array', minItems: 4, maxItems: 4 });
    expect(s.properties.bars.items).toMatchObject({ type: 'array', minItems: 1, maxItems: 16 });
    expect(s.properties.bars.items.items).toEqual({
      type: 'object', additionalProperties: false, required: ['pitch', 'beats'],
      properties: { pitch: { type: 'string', pattern: PITCH }, beats: { enum: [0.5, 1, 1.5, 2, 3, 4] } },
    });
  });

  it('lets the phrase start only where N bars still fit', () => {
    expect((phraseOpSchema(65, 4) as any).properties.start_bar).toEqual({ type: 'integer', minimum: 1, maximum: 62 });
    expect((phraseOpSchema(65, 2) as any).properties.bars).toMatchObject({ minItems: 2, maxItems: 2 });
    expect((phraseOpSchema(3, 4) as any).properties.start_bar.maximum).toBe(1);
  });
});

describe('phraseProblems', () => {
  it('passes a well-formed phrase', () => {
    expect(phraseProblems(phrase(), 65, 4)).toEqual([]);
  });

  it('refuses ABC strings anywhere in bars (F-026 #1)', () => {
    const abc = 'bars are arrays of {pitch, beats} notes; ABC strings are not accepted';
    expect(phraseProblems(phrase({ bars: 'D2F2A2d2|' }), 65, 4)).toEqual([abc]);
    expect(phraseProblems(phrase({ bars: [bar, 'D2F2A2d2', bar, bar] }), 65, 4)).toEqual([abc]);
  });

  it('names a wrong bar count against the request, and a phrase past the last bar', () => {
    expect(phraseProblems(phrase({ bars: [bar, bar, bar] }), 65, 4)).toEqual(['the phrase has 3 bars; the request asks for 4']);
    expect(phraseProblems(phrase({ start_bar: 63 }), 65, 4)).toEqual(['a 4-bar phrase at bar 63 runs past the last bar (65)']);
    expect(phraseProblems(phrase({ start_bar: 0 }), 65, 4)).toEqual(['start_bar 0 is outside the score (bars 1-65)']);
  });

  it('names a bad instrument, pitch, length and note count with where they are', () => {
    const bad = [note('H', 1), note('D', 0.75), note('E', 1), note('F', 1)];
    expect(phraseProblems(phrase({ instrument: '', bars: [bar, bad, [], bar] }), 65, 4)).toEqual([
      'instrument must be 1-40 characters',
      'bar 2 of the phrase: pitch "H" is not an ABC pitch (a letter A-G or a-g, optional ^ _ =, optional , or \'; z for a rest)',
      'bar 2 of the phrase: beats 0.75 is not one of 0.5, 1, 1.5, 2, 3, 4',
      'bar 3 of the phrase has 0 notes; write 1-16',
    ]);
  });
});
