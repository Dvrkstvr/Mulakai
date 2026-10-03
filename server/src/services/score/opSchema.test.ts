import { describe, it, expect } from 'vitest';
import { beatsPerBar, buildOpSchema, checkOps } from './opSchema.js';
import type { ScoreFacts } from './planTypes.js';

const facts = (over: Partial<ScoreFacts['header']> = {}, barMap: string[] = []): ScoreFacts => ({
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 65, seconds: 179.3, units_per_quarter: 8, ...over },
  key_notes: 'D E F G A Bb C',
  sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 46 }, { index: 2, label: 'chorus', from_bar: 47, to_bar: 65 }],
  lyric_blocks: [],
  bar_map: barMap,
});

type Schema = { properties: { ops: { minItems: number; maxItems: number; items: { anyOf: Array<Record<string, any>> } } } };
const opSchema = (s: unknown, name: string) => (s as Schema).properties.ops.items.anyOf.find((o) => o.properties.op.const === name)!;

describe('buildOpSchema (F-019 #1)', () => {
  it('bounds bars by the song and beats by its meter', () => {
    const s = buildOpSchema(facts());
    const rh = opSchema(s, 'REHARMONIZE');
    expect(rh.properties.from_bar).toMatchObject({ type: 'integer', minimum: 1, maximum: 65 });
    expect(rh.properties.to_bar).toMatchObject({ minimum: 1, maximum: 65 });
    const chord = rh.properties.chords.items;
    expect(chord.properties.bar).toMatchObject({ minimum: 1, maximum: 65 });
    expect(chord.properties.beat).toMatchObject({ minimum: 1, maximum: 4 });
    expect(chord.properties.root.enum).toHaveLength(17);
    expect(chord.properties.quality.enum).toHaveLength(15);
    expect(chord.additionalProperties).toBe(false);
    expect(chord.required).toEqual(['bar', 'beat', 'root', 'quality']);
  });

  it('is rebuilt per song: another bar count gives another maximum', () => {
    expect(opSchema(buildOpSchema(facts({ bars: 120 })), 'REHARMONIZE').properties.to_bar.maximum).toBe(120);
  });

  it('allows 1-6 ops, SET_TEMPO 40-240, only the three M0 ops, nothing extra', () => {
    const s = buildOpSchema(facts()) as Schema & { additionalProperties: boolean; required: string[] };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['ops']);
    expect(s.properties.ops).toMatchObject({ minItems: 1, maxItems: 6 });
    expect(s.properties.ops.items.anyOf.map((o) => o.properties.op.const)).toEqual(['SET_TEMPO', 'REHARMONIZE', 'EDIT_STYLE']);
    expect(opSchema(s, 'SET_TEMPO').properties.bpm).toMatchObject({ minimum: 40, maximum: 240 });
    for (const o of s.properties.ops.items.anyOf) expect(o.additionalProperties).toBe(false);
  });
});

describe('beatsPerBar', () => {
  it('counts quarter notes in the widest meter, including meter changes in the bar map', () => {
    expect(beatsPerBar(facts({ meter: '3/4' }))).toBe(3);
    expect(beatsPerBar(facts({ meter: '6/8' }))).toBe(3);
    expect(beatsPerBar(facts({ meter: '2/4' }, ['(meter M:4/4 from here: one bar = 32 units)']))).toBe(4);
  });
});

describe('checkOps', () => {
  it('accepts a valid op list', () => {
    const ops = [{ op: 'SET_TEMPO', bpm: 88 }, { op: 'REHARMONIZE', from_bar: 47, to_bar: 47, chords: [{ bar: 47, beat: 1, root: 'D', quality: 'm7' }] }];
    expect(checkOps({ ops }, facts())).toEqual({ ok: true, ops });
  });

  it('rejects bar 999 with a per-op reason naming the bounds (F-019 #3)', () => {
    const r = checkOps({ ops: [{ op: 'SET_TEMPO', bpm: 88 }, { op: 'REHARMONIZE', from_bar: 999, to_bar: 999, chords: [{ bar: 999, beat: 1, root: 'G', quality: 'm7' }] }] }, facts());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons).toEqual([
      'op 2 (REHARMONIZE): from_bar 999 is outside the score (bars 1-65)',
      'op 2 (REHARMONIZE): to_bar 999 is outside the score (bars 1-65)',
      'op 2 (REHARMONIZE): chord bar 999 is outside the score (bars 1-65)',
    ]);
  });

  it('rejects a beat past the bar, a reversed range, unknown ops and bad shapes', () => {
    const r = checkOps({ ops: [
      { op: 'REHARMONIZE', from_bar: 10, to_bar: 8, chords: [{ bar: 9, beat: 5, root: 'H', quality: 'm7' }] },
      { op: 'TRANSPOSE', semitones: 2 },
      { op: 'SET_TEMPO', bpm: 400 },
    ] }, facts());
    expect(!r.ok && r.reasons).toEqual([
      'op 1 (REHARMONIZE): to_bar 8 is before from_bar 10',
      'op 1 (REHARMONIZE): chord beat 5 is past the bar (beats 1-4)',
      'op 1 (REHARMONIZE): chord root H is not one of the 17 roots',
      'op 2 (TRANSPOSE): not an op this editor knows (SET_TEMPO, REHARMONIZE, EDIT_STYLE)',
      'op 3 (SET_TEMPO): bpm 400 is outside 40-240',
    ]);
    expect(checkOps('nope', facts())).toEqual({ ok: false, reasons: ['the reply is not a JSON object {"ops":[...]}'] });
    expect(checkOps({ ops: [] }, facts())).toEqual({ ok: false, reasons: ['the reply has 0 ops; send 1 to 6'] });
  });
});
