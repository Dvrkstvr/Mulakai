/** The MARK block (F-055 #1, D-177, D-179): one function gives the prompt lines and WHAT IT SEES (rows + AS SENT),
 * so the chip shows exactly what the turn sends. */
import { describe, it, expect } from 'vitest';
import { markBlock } from './markBlock.js';
import type { RangeMark, VersionAnalysis } from './analysisTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/8', bpm: 96, key: 'Am', bars: 16, seconds: 40, units_per_quarter: 2 },
  key_notes: '',
  sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 4 }, { index: 2, label: 'chorus', from_bar: 5, to_bar: 8 },
    { index: 3, label: 'verse', from_bar: 9, to_bar: 12 }, { index: 4, label: 'chorus', from_bar: 13, to_bar: 16 },
  ],
  lyric_blocks: [
    { index: 1, tag: '[Verse]', occurrence: 1, lines: 2, first_line: 'walking out' },
    { index: 2, tag: '[Chorus]', occurrence: 1, lines: 2, first_line: 'hold on' },
    { index: 3, tag: '[Verse]', occurrence: 2, lines: 2, first_line: 'coming home' },
    { index: 4, tag: '[Chorus]', occurrence: 2, lines: 2, first_line: 'hold on tight' },
  ],
  bar_map: [],
};
const starts = Array.from({ length: 16 }, (_, i) => i * 2.5);
const analysis = (over: Partial<VersionAnalysis> = {}): VersionAnalysis => ({
  analysis_v: 1, versionId: 'v4', readAt: '2026-10-07T10:00:00Z', plan: { words: 'skip', score: 'own', sections: 'cached' },
  words: { notRead: 'LYRICS_API_URL is not set' },
  score: { abc: 'X:1', source: 'own', chords: true, facts, warnings: [], measure: null },
  bars: { source: 'cached', offset: 0, starts, end: 40, agreement: 0.9 },
  ...over,
});
const mark: RangeMark = { kind: 'range', versionId: 'v4', bars: [13, 16], seconds: [30, 40], label: 'CHORUS 2' };

describe('markBlock', () => {
  it('a whole section: bars, seconds, the section, its lyric block, key and tempo', () => {
    const out = markBlock({ mark, number: 4, analysis: analysis(), words: null });
    expect(out.lines).toEqual([
      'MARK (the person marked part of v4 on the player; "this", "here" and "it" in the REQUEST mean it): bars 13-16, 0:30-0:40.',
      'MARKED SECTIONS: S4 chorus #2 bars 13-16 (whole)',
      'MARKED LYRICS: [Chorus] #2, 2 lines, first line: hold on tight',
      'AT THE MARK: key Am · 96 BPM · 4/4',
      'Plan bar ops only inside bars 13-16; a tempo, key or style op changes the whole song.',
    ]);
    expect(out.preview.rows).toEqual([
      { name: 'VERSION', value: 'v4' }, { name: 'BARS', value: '13-16' }, { name: 'TIME', value: '0:30-0:40' },
      { name: 'SECTIONS', value: 'CHORUS 2 (whole)' }, { name: 'LYRICS', value: '[Chorus] #2, 2 lines, first line: hold on tight' },
      { name: 'KEY', value: 'Am' }, { name: 'TEMPO', value: '96 BPM' }, { name: 'METER', value: '4/4' },
    ]);
    expect(out.preview.sent).toEqual({
      version: 4, versionId: 'v4', bars: [13, 16], seconds: [30, 40],
      sections: [{ section: 4, label: 'chorus', occurrence: 2, bars: [13, 16], whole: true }],
      lyrics: ['[Chorus] #2, 2 lines, first line: hold on tight'], key: 'Am', bpm: 96, meter: '4/4',
    });
    expect(out.bars).toEqual([13, 16]);
  });

  it('across two sections, one partly; lyrics from word timings inside the seconds', () => {
    const words: LyricsReading = { language: 'en', segments: [
      { text: 'hold on', start: 11, end: 14, words: [] }, { text: 'coming home', start: 21, end: 24, words: [] },
      { text: 'far away', start: 26, end: 29, words: [] },
    ] };
    const out = markBlock({ mark: { kind: 'range', versionId: 'v4', bars: [7, 10], seconds: [15, 25] }, number: 4, analysis: analysis(), words });
    expect(out.lines[1]).toBe('MARKED SECTIONS: S2 chorus #1 bars 5-8 (partly: bars 7-8); S3 verse #2 bars 9-12 (partly: bars 9-10)');
    expect(out.lines[2]).toBe('MARKED LYRICS: "coming home"');
  });

  it('seconds only (bars not read): says so and sends no bars', () => {
    const out = markBlock({ mark: { kind: 'range', versionId: 'v4', seconds: [30, 40] }, number: 4,
      analysis: analysis({ bars: { notRead: 'no grid' } }), words: null });
    expect(out.lines[0]).toBe('MARK (the person marked part of v4 on the player; "this", "here" and "it" in the REQUEST mean it): 0:30-0:40, bars not read.');
    expect(out.lines.at(-1)).toBe('The bars of this version were not read: the mark is a time only; plan against the sections nearest it.');
    expect(out.bars).toBeNull();
    expect(out.preview.sent).toMatchObject({ bars: null, sections: [] });
    expect(out.preview.rows[1]).toEqual({ name: 'BARS', value: 'not read' });
  });

  it('bars sent from a strip whose version has no bar times now: no bars are sent (D-179)', () => {
    const out = markBlock({ mark, number: 4, analysis: analysis({ bars: { notRead: 'no grid' } }), words: null });
    expect(out.bars).toBeNull();
    expect(out.sent.bars).toBeNull();
  });

  it('no analysis at all: bars as marked, sections and key not read', () => {
    const out = markBlock({ mark, number: 4, analysis: null, words: null });
    expect(out.lines).toContain('AT THE MARK: key and tempo not read');
    expect(out.preview.rows.find((r) => r.name === 'SECTIONS')).toEqual({ name: 'SECTIONS', value: 'not read' });
    expect(out.bars).toEqual([13, 16]);
  });
});
