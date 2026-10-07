/** A mark limits the plan (D-176, F-055 #1 and edge): bar ops inside it, a section op outside it is a retry
 * reason, a whole-song op is allowed with a note, a mark past the song or shorter than a phrase is clamped. */
import { describe, it, expect } from 'vitest';
import { markBars, markFit } from './markFit.js';
import type { Op, ScoreFacts } from '../score/planTypes.js';

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/8', bpm: 87, key: 'Dm', bars: 65, seconds: 179, units_per_quarter: 2 },
  key_notes: '',
  sections: [
    { index: 1, label: 'intro', from_bar: 1, to_bar: 10 }, { index: 2, label: 'verse', from_bar: 11, to_bar: 46 },
    { index: 3, label: 'chorus', from_bar: 47, to_bar: 62 }, { index: 4, label: 'outro', from_bar: 63, to_bar: 65 },
  ],
  lyric_blocks: [
    { index: 1, tag: '[Verse]', occurrence: 1, lines: 2, first_line: 'walking out' },
    { index: 2, tag: '[Chorus]', occurrence: 1, lines: 2, first_line: 'hold on' },
  ],
  bar_map: [],
};
const range: [number, number] = [47, 58];
const chord = (bar: number) => ({ bar, beat: 1, root: 'C', quality: 'maj' });

describe('markFit', () => {
  it('ops inside the mark pass with no note', () => {
    const ops = [{ op: 'REHARMONIZE', from_bar: 47, to_bar: 50, chords: [chord(47)] }, { op: 'REPEAT', section: 3, label: 'chorus' }] as Op[];
    expect(markFit(ops, range, facts)).toEqual({ reasons: [], notes: [] });
  });
  it('bars outside the mark are a retry reason', () => {
    const ops = [{ op: 'REHARMONIZE', from_bar: 40, to_bar: 50, chords: [chord(40), chord(48)] }] as Op[];
    expect(markFit(ops, range, facts).reasons).toEqual(['op 1 (REHARMONIZE): bar 40 is outside the mark (bars 47-58); plan only inside it']);
  });
  it('a phrase starting outside the mark is a retry reason', () => {
    const ops = [{ op: 'WRITE_PHRASE', start_bar: 20, instrument: 'sax', bars: [] }] as unknown as Op[];
    expect(markFit(ops, range, facts).reasons).toEqual(['op 1 (WRITE_PHRASE): bar 20 is outside the mark (bars 47-58); plan only inside it']);
  });
  it('a section op on a section outside the mark is a retry reason', () => {
    const ops = [{ op: 'CUT', section: 2, label: 'verse' }] as Op[];
    expect(markFit(ops, range, facts).reasons).toEqual(['op 1 (CUT): S2 verse (bars 11-46) is outside the mark (bars 47-58)']);
  });
  it('a lyric rewrite of a block sung outside the mark is a retry reason', () => {
    const verse = [{ op: 'REWRITE_LYRICS', block: 1, tag: '[Verse]', occurrence: 1, lines: ['a'] }] as Op[];
    const chorus = [{ op: 'REWRITE_LYRICS', block: 2, tag: '[Chorus]', occurrence: 1, lines: ['a'] }] as Op[];
    expect(markFit(verse, range, facts).reasons).toEqual(['op 1 (REWRITE_LYRICS): lyric block 1 is sung in S2 verse (bars 11-46), outside the mark (bars 47-58)']);
    expect(markFit(chorus, range, facts).reasons).toEqual([]);
  });
  it('a phrase longer than the mark starts in it and runs past it, said on the card', () => {
    const ops = [{ op: 'WRITE_PHRASE', start_bar: 47, instrument: 'sax', bars: [[], [], [], []] }] as unknown as Op[];
    expect(markFit(ops, [47, 48], facts)).toEqual({ reasons: [], notes: ['the phrase is 4 bars, longer than the mark (2 bars): it starts at bar 47 and runs to bar 50'] });
  });
  it('a whole-song op is allowed and the card says so', () => {
    const ops = [{ op: 'SET_TEMPO', bpm: 90 }, { op: 'TRANSPOSE', semitones: 2 }] as Op[];
    expect(markFit(ops, range, facts)).toEqual({ reasons: [], notes: ['SET TEMPO, TRANSPOSE change the whole song, not only the marked bars'] });
  });
});

describe('markBars', () => {
  it('a mark inside the song is its own range', () => expect(markBars([47, 58], 65)).toEqual({ range: [47, 58], notes: [] }));
  it('a mark past the score is clamped with the reason', () => {
    expect(markBars([60, 70], 65)).toEqual({ range: [60, 65], notes: ['the mark reaches bar 70 but the score ends at bar 65: planned on bars 60-65'] });
  });
  it('a mark wholly past the score has no range', () => {
    expect(markBars([70, 72], 65)).toEqual({ range: null, notes: ['the mark (bars 70-72) is past the end of the score (bar 65)'] });
  });
});
