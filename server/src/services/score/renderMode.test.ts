/** F-065 #1 (D-132): the render's cot comes from the score as read and the plan's ops. */
import { describe, it, expect } from 'vitest';
import { renderMode } from './renderMode.js';
import type { Op } from './planTypes.js';

const TEMPO: Op = { op: 'SET_TEMPO', bpm: 96 };
const TRANSPOSE: Op = { op: 'TRANSPOSE', semitones: 2 };
const REPEAT: Op = { op: 'REPEAT', section: 2, label: 'Chorus' };
const REHARM: Op = { op: 'REHARMONIZE', from_bar: 5, to_bar: 6, chords: [{ bar: 5, beat: 1, root: 'D', quality: 'm7' }, { bar: 6, beat: 1, root: 'G', quality: '7' }] };

describe('renderMode', () => {
  it.each([
    ['a score with chords, a tempo change', true, [TEMPO], 'full', 'chords'],
    ['a score with chords, a reharmonize', true, [REHARM], 'full', 'chords'],
    ['a chord-free score, SET TEMPO', false, [TEMPO], 'melody', 'melody'],
    ['a chord-free score, REPEAT', false, [REPEAT], 'melody', 'melody'],
    ['a chord-free score, TRANSPOSE', false, [TRANSPOSE], 'melody', 'melody'],
    ['a chord-free score, REHARMONIZE among others', false, [TEMPO, REHARM], 'full', 'reharmonize'],
    ['an unknown chord read, no reharmonize', null, [TEMPO], 'melody', 'melody'],
  ] as const)('%s → cot %s', (_name, chordsPresent, ops, cot, reason) => {
    expect(renderMode({ chordsPresent, ops: [...ops] })).toEqual({ cot, reason });
  });

  it('a chord-free plan with no ops renders the melody', () => {
    expect(renderMode({ chordsPresent: false, ops: [] }).cot).toBe('melody');
  });
});
