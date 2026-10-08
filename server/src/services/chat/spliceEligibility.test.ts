/** Which plans splice into the old take and which re-render the whole song (F-046 #2, F-047 edge, F-065 edge, D-154). */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { spliceEligibility, type SpliceInput } from './spliceEligibility.js';
import type { Op, ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts; // 65 bars of 4/4: intro 1-10, verse 11-46, chorus 47-62, outro 63-65
const song: SpliceInput = { facts, chordsPresent: true };
const reharm = (from_bar: number, to_bar: number): Op =>
  ({ op: 'REHARMONIZE', from_bar, to_bar, chords: [{ bar: from_bar, beat: 1, root: 'G', quality: 'm7' }] });

describe('splice eligibility (pure)', () => {
  it('one REHARMONIZE on a 4/4 song with chords splices exactly its bars', () => {
    expect(spliceEligibility([reharm(47, 54)], song)).toEqual({ splice: true, kind: 'reharmonize', from_bar: 47, to_bar: 54 });
  });

  it('one CUT or one REPEAT splices the section it names, as read (D-154)', () => {
    expect(spliceEligibility([{ op: 'CUT', section: 3, label: 'chorus' }], song)).toEqual({ splice: true, kind: 'cut', from_bar: 47, to_bar: 62 });
    expect(spliceEligibility([{ op: 'REPEAT', section: 2, label: 'verse' }], song)).toEqual({ splice: true, kind: 'repeat', from_bar: 11, to_bar: 46 });
  });

  it('C1 N1: a REPEAT of the last section re-renders whole, saying so on the card (its last bar is the song\'s ending, D-213)', () => {
    expect(spliceEligibility([{ op: 'REPEAT', section: 4, label: 'outro' }], song)).toEqual({
      splice: false,
      reason: 'the outro ends the song: its last bar is the ending, so the old audio has nothing to play the copy after',
    });
    // a CUT of the last section still splices (the song now ends at the bar before it, faded)
    expect(spliceEligibility([{ op: 'CUT', section: 4, label: 'outro' }], song)).toEqual({ splice: true, kind: 'cut', from_bar: 63, to_bar: 65 });
  });

  it('the other kinds are re-rendered whole, with the reason (D-150: REWRITE LYRICS and WRITE PHRASE are heard)', () => {
    for (const op of [
      { op: 'REWRITE_LYRICS', block: 1, tag: '[Verse]', occurrence: 1, lines: ['a'] },
      { op: 'WRITE_PHRASE', start_bar: 11, instrument: 'sax', bars: [] },
      { op: 'SET_TEMPO', bpm: 100 }, { op: 'TRANSPOSE', semitones: 2 }, { op: 'EDIT_STYLE', style: 'jazz' },
    ] as Op[]) {
      const out = spliceEligibility([op], song);
      expect(out.splice).toBe(false);
      if (!out.splice) expect(out.reason).toContain(op.op.replace('_', ' '));
    }
  });

  it('more than one change re-renders the whole song', () => {
    expect(spliceEligibility([reharm(47, 54), { op: 'SET_TEMPO', bpm: 90 }], song))
      .toEqual({ splice: false, reason: 'the plan makes 2 changes; only a single change can be spliced into the old take' });
    expect(spliceEligibility([], song).splice).toBe(false);
  });

  it('F-047 edge: a 3/4 song, or a meter change inside the song, re-renders whole (SP-4 tested 4/4 only)', () => {
    const waltz = { ...facts, header: { ...facts.header, meter: '3/4' } };
    expect(spliceEligibility([reharm(47, 54)], { facts: waltz, chordsPresent: true }))
      .toEqual({ splice: false, reason: 'the song is in 3/4; splicing is tested on 4/4 only' });
    const changes = { ...facts, bar_map: [...facts.bar_map.slice(0, 20), '(meter M:3/4 from here: one bar = 24 units)', ...facts.bar_map.slice(20)] };
    expect(spliceEligibility([reharm(47, 54)], { facts: changes, chordsPresent: true }))
      .toEqual({ splice: false, reason: 'the meter changes to 3/4 inside the song; splicing is tested on 4/4 only' });
  });

  it('F-065 edge: REHARMONIZE on a chord-free score takes the whole-song path (the render mode changes for the whole song)', () => {
    for (const chordsPresent of [false, null]) {
      expect(spliceEligibility([reharm(47, 54)], { facts, chordsPresent }))
        .toEqual({ splice: false, reason: 'the song has no chords: adding them renders the whole song with chords' });
    }
  });

  it('a chord-free score re-renders CUT and REPEAT whole too (the join is fitted on the score\'s chords)', () => {
    const out = spliceEligibility([{ op: 'CUT', section: 3, label: 'chorus' }], { facts, chordsPresent: false });
    expect(out).toEqual({ splice: false, reason: 'the song has no chords to align the join on' });
  });

  it('a span outside the song, or a section the read lacks, is not spliced', () => {
    expect(spliceEligibility([reharm(60, 70)], song)).toEqual({ splice: false, reason: 'bars 60-70 are not inside the song\'s 65 bars' });
    expect(spliceEligibility([{ op: 'CUT', section: 9, label: 'bridge' }], song)).toEqual({ splice: false, reason: 'section S9 is not in the song as read' });
  });
});
