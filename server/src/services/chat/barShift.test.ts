/** The one bar-movement rule (D-180): every op kind, splice kinds, repaint, retake, ACE-Step, unknown. */
import { describe, it, expect } from 'vitest';
import { barShift, composeShifts } from './barShift.js';
import type { ScoreSection } from '../score/planTypes.js';

const sections: ScoreSection[] = [
  { index: 1, label: 'verse', from_bar: 1, to_bar: 8 },
  { index: 2, label: 'chorus', from_bar: 9, to_bar: 16 },
  { index: 3, label: 'verse', from_bar: 17, to_bar: 24 },
];
const score = (ops: unknown[], extra: Record<string, unknown> = {}) => ({ score_v: 1, engine: 'yue2', task_type: 'score', ops, basedOn: 'v1', ...extra });
const KEEP = { moved: false };
const RETIMED = { moved: false, retimed: true };

describe('barShift', () => {
  it.each([
    ['REHARMONIZE', { op: 'REHARMONIZE', from_bar: 9, to_bar: 16, chords: [] }],
    ['TRANSPOSE', { op: 'TRANSPOSE', semitones: 2 }],
    ['EDIT STYLE', { op: 'EDIT_STYLE', style: 'jazz' }],
    ['REWRITE LYRICS', { op: 'REWRITE_LYRICS', block: 1, tag: 'verse', occurrence: 1, lines: ['a'] }],
    ['WRITE PHRASE', { op: 'WRITE_PHRASE', start_bar: 3, instrument: 'sax', bars: [] }],
  ])('%s keeps the bars', (_, op) => {
    expect(barShift({ params: score([op]) })).toEqual(KEEP);
  });

  it('SET TEMPO keeps the bars but moves their seconds (retimed), alone or with other bar-keeping ops', () => {
    expect(barShift({ params: score([{ op: 'SET_TEMPO', bpm: 88 }]) })).toEqual(RETIMED);
    expect(barShift({ params: score([{ op: 'SET_TEMPO', bpm: 90 }, { op: 'TRANSPOSE', semitones: -1 }]) })).toEqual(RETIMED);
  });

  it('several bar-keeping ops with no tempo change keep the bars and their seconds', () => {
    expect(barShift({ params: score([{ op: 'EDIT_STYLE', style: 'jazz' }, { op: 'TRANSPOSE', semitones: -1 }]) })).toEqual(KEEP);
  });

  it('a spliced REHARMONIZE keeps the bars', () => {
    const splice = { splice_v: 1, kind: 'reharmonize', bars: [9, 16] };
    expect(barShift({ params: score([{ op: 'REHARMONIZE', from_bar: 9, to_bar: 16, chords: [] }], { splice }) })).toEqual(KEEP);
  });

  it('a spliced CUT moves the bars after it back, with the shift', () => {
    const splice = { splice_v: 1, kind: 'cut', bars: [9, 16] };
    expect(barShift({ params: score([{ op: 'CUT', section: 2, label: 'chorus' }], { splice }) }))
      .toEqual({ moved: true, shift: { atBar: 17, delta: -8 } });
  });

  it('a spliced REPEAT moves the bars after it on, with the shift', () => {
    const splice = { splice_v: 1, kind: 'repeat', bars: [9, 16] };
    expect(barShift({ params: score([{ op: 'REPEAT', section: 2, label: 'chorus' }], { splice }) }))
      .toEqual({ moved: true, shift: { atBar: 17, delta: 8 } });
  });

  it('a whole-render CUT finds its span in the base sections', () => {
    const params = score([{ op: 'CUT', section: 1, label: 'verse' }], { splice: { splice_v: 1, fallback: 'not aligned' } });
    expect(barShift({ params, baseSections: sections })).toEqual({ moved: true, shift: { atBar: 9, delta: -8 } });
  });

  it('a CUT without the base sections, or whose label no longer matches, moves with no shift', () => {
    const cut = score([{ op: 'CUT', section: 3, label: 'verse' }]);
    expect(barShift({ params: cut })).toEqual({ moved: true, shift: null });
    expect(barShift({ params: score([{ op: 'CUT', section: 2, label: 'verse' }]), baseSections: sections })).toEqual({ moved: true, shift: null });
  });

  it('two section moves in one plan move with no single shift', () => {
    const ops = [{ op: 'CUT', section: 1, label: 'verse' }, { op: 'REPEAT', section: 2, label: 'chorus' }];
    expect(barShift({ params: score(ops), baseSections: sections })).toEqual({ moved: true, shift: null });
  });

  it('a truncated render or an unknown op moves with no shift', () => {
    expect(barShift({ params: score([{ op: 'SET_TEMPO', bpm: 90 }], { truncated: true }) })).toEqual({ moved: true, shift: null });
    expect(barShift({ params: score([{ op: 'STRETCH' }]) })).toEqual({ moved: true, shift: null });
    expect(barShift({ params: score('nope' as unknown as unknown[]) })).toEqual({ moved: true, shift: null });
  });

  it('a repaint keeps the timeline of the version it names (basedOn)', () => {
    expect(barShift({ params: { task_type: 'repaint', repainting_start: 10, repainting_end: 20, basedOn: 'v1' } })).toEqual(KEEP);
  });

  it('a repaint or score edit that names no basedOn proves no parent: moved with no shift', () => {
    expect(barShift({ params: { task_type: 'repaint', repainting_start: 10, repainting_end: 20 } })).toEqual({ moved: true, shift: null });
    const { basedOn: _b, ...unnamed } = score([{ op: 'TRANSPOSE', semitones: 2 }]);
    expect(barShift({ params: unnamed })).toEqual({ moved: true, shift: null });
  });

  it.each([
    ['a YuE2 new take or retake', { engine: 'yue2', task_type: 'text2music' }],
    ['an ACE-Step take', { task_type: 'text2music' }],
    ['an ACE-Step cover', { task_type: 'cover' }],
    ['an import', { task_type: 'import' }],
    ['unknown params', {}],
    ['garbage', null],
  ])('%s moves the bars with no shift', (_, params) => {
    expect(barShift({ params })).toEqual({ moved: true, shift: null });
  });
});

describe('composeShifts', () => {
  const cut = { moved: true as const, shift: { atBar: 17, delta: -8 } };
  it('nothing moved over the chain keeps the bars', () => {
    expect(composeShifts([])).toEqual(KEEP);
    expect(composeShifts([KEEP, KEEP])).toEqual(KEEP);
  });
  it('a tempo change anywhere in a chain that kept the bars re-times them', () => {
    expect(composeShifts([RETIMED, KEEP])).toEqual(RETIMED);
  });
  it('one known move among keeps is that move', () => {
    expect(composeShifts([KEEP, cut, KEEP])).toEqual(cut);
  });
  it('two moves, or one unknown, have no single shift', () => {
    expect(composeShifts([cut, cut])).toEqual({ moved: true, shift: null });
    expect(composeShifts([KEEP, { moved: true, shift: null }])).toEqual({ moved: true, shift: null });
  });
});
