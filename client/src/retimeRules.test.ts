import { describe, expect, it } from 'vitest';
import type { RetimeResult } from './api';
import { BPM_CHIP, bpmField, type BpmField } from './bpmField';
import {
  chipBlocked, dropsMany, readTypedBpm, readingRetimeConsequence, readingSlightHint, retimeConsequence, retimeRefusal, slightHint,
  slightlyOff, targetBpm,
} from './retimeRules';

const result = (over: Partial<RetimeResult> = {}): RetimeResult => ({
  abc: 'X:1', measures: 48, bpm: 70, readBpm: 140, vocalNotes: 150, insNotes: 10, notes: 183, droppedNotes: 0, warnings: [], ...over,
});

describe('retimeRules', () => {
  it('a choice names the tempo the reading becomes', () => {
    expect(targetBpm(140, { mode: 'half' })).toBe(70);
    expect(targetBpm(140, { mode: 'double' })).toBe(280);
    expect(targetBpm(140, { mode: 'bpm', bpm: 92 })).toBe(92);
  });

  it('HALF or DOUBLE is off, with the reason, when it leaves 40-240 (Q-129, A7)', () => {
    expect(chipBlocked(140, 'half')).toBeNull();
    expect(chipBlocked(140, 'double')).toBe('DOUBLE is off: 280 BPM is over the limit');
    expect(chipBlocked(75, 'half')).toBe('HALF is off: 38 BPM is under the limit');
    expect(chipBlocked(120, 'double')).toBeNull();
  });

  it('a typed BPM is a whole number in 40-240', () => {
    expect(readTypedBpm('92')).toEqual({ bpm: 92 });
    expect(readTypedBpm(' ')).toEqual({ why: 'type a BPM' });
    expect(readTypedBpm('300')).toEqual({ why: '300 BPM IS OUTSIDE 40–240' });
    expect(readTypedBpm('39')).toEqual({ why: '39 BPM IS OUTSIDE 40–240' });
    expect(readTypedBpm('9.5')).toEqual({ why: '9.5 is not a whole number' });
  });

  it('a BPM within 8 % of the reading is slightly off: SET TEMPO, not RE-TIME (Q-125)', () => {
    expect(slightlyOff(140, 144)).toBe(true);
    expect(slightlyOff(140, 151)).toBe(true);
    expect(slightlyOff(140, 152)).toBe(false);
    expect(slightlyOff(140, 92)).toBe(false);
    expect(slightHint(140, 144)).toMatch(/^144 is within 8 % of the 140 read/);
  });

  it('the consequence line names the new tempo, the bars and what the slower grid leaves out', () => {
    expect(retimeConsequence(96, result())).toBe(
      'Rebuilds the score at 70 BPM: 96 bars → 48 · from the saved reading, no GPU · every note kept'
      + ' · the piano preview is not redrawn · UNDO returns to the reading');
    expect(retimeConsequence(96, result({ droppedNotes: 16 }))).toContain('16 of 183 notes are too short for the slower grid');
  });

  it('on a chat reading the line says every bar number changes and a mark goes stale (RT-5, B2)', () => {
    expect(readingRetimeConsequence(96, result())).toBe('Re-times the reading at 70 BPM: 96 bars → 48, every bar number changes'
      + ' · from the saved reading, no GPU, a few seconds · a mark on this version goes stale: mark again · nothing is saved to your library');
    expect(readingRetimeConsequence(96, result({ droppedNotes: 16 }))).toContain(' · 16 of 183 notes are left out of the score · ');
    expect(readingSlightHint(140, 145)).not.toContain('SCORE dock');
  });

  it('warns when more than 10 % of the notes are left out (D-210)', () => {
    expect(dropsMany(result({ droppedNotes: 18 }))).toBe(false);
    expect(dropsMany(result({ droppedNotes: 19 }))).toBe(true);
    expect(dropsMany(result({ notes: 0 }))).toBe(false);
  });

  it('a refusal says what happened and that nothing changed', () => {
    expect(retimeRefusal('no_bundle', 'gone')).toMatch(/^THE SAVED READING IS GONE/);
    expect(retimeRefusal('out_of_range', '38 BPM is outside 40-240')).toBe('38 BPM IS OUTSIDE 40-240 · nothing changed');
    expect(retimeRefusal('retime_refused', 'MelodyVoiceError: x')).toBe('COULD NOT RE-TIME · MelodyVoiceError: x · nothing changed');
  });
});

describe('bpmField (D-211)', () => {
  const run = (...events: Parameters<typeof bpmField>[1][]) => events.reduce<BpmField>(bpmField, BPM_CHIP);

  it('a click turns the chip into an empty field; typing keeps digits only', () => {
    expect(run({ type: 'open' })).toEqual({ kind: 'open', text: '', why: null });
    expect(run({ type: 'open' }, { type: 'type', text: '9a2' })).toEqual({ kind: 'open', text: '92', why: null });
    expect(run({ type: 'open' }, { type: 'type', text: '12345' })).toMatchObject({ text: '123' });
  });

  it('Enter (or the ↵ icon) locks a valid BPM', () => {
    expect(run({ type: 'open' }, { type: 'type', text: '92' }, { type: 'enter' })).toEqual({ kind: 'locked', bpm: 92 });
  });

  it('Enter on an empty or out-of-range value keeps the field open with the reason; typing clears it', () => {
    const bad = run({ type: 'open' }, { type: 'type', text: '300' }, { type: 'enter' });
    expect(bad).toEqual({ kind: 'open', text: '300', why: '300 BPM IS OUTSIDE 40–240' });
    expect(bpmField(bad, { type: 'type', text: '30' })).toMatchObject({ why: null });
    expect(run({ type: 'open' }, { type: 'enter' })).toMatchObject({ kind: 'open', why: 'type a BPM' });
  });

  it('a click outside turns it back into the chip with no BPM set, also from a reopened lock', () => {
    expect(run({ type: 'open' }, { type: 'type', text: '92' }, { type: 'leave' })).toEqual(BPM_CHIP);
    const reopened = run({ type: 'open' }, { type: 'type', text: '92' }, { type: 'enter' }, { type: 'open' });
    expect(reopened).toEqual({ kind: 'open', text: '92', why: null });
    expect(bpmField(reopened, { type: 'leave' })).toEqual(BPM_CHIP);
  });

  it('a locked BPM stays through a stray leave; picking another mode resets it', () => {
    const locked: BpmField = { kind: 'locked', bpm: 92 };
    expect(bpmField(locked, { type: 'leave' })).toBe(locked);
    expect(bpmField(locked, { type: 'enter' })).toBe(locked);
    expect(bpmField(locked, { type: 'reset' })).toEqual(BPM_CHIP);
  });
});
