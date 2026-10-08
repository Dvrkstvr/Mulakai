/** C1 live B4 (F-053): the reading line's LINES come from the same pairing as the strip, never a separate sum. */
import { describe, it, expect } from 'vitest';
import { readingLines } from './readingLines.js';
import { stripSections } from './analysisView.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';

const block = (index: number, tag: string, occurrence: number, lines: number) => ({ index, tag, occurrence, lines, first_line: 'x' });
const facts = (over: Partial<ScoreFacts> = {}): ScoreFacts => ({
  header: { meter: '4/4', unit: '1/8', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 2 },
  key_notes: '',
  sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 2 },
    { index: 2, label: 'chorus', from_bar: 3, to_bar: 4 },
    { index: 3, label: 'verse', from_bar: 5, to_bar: 6 },
    { index: 4, label: 'chorus', from_bar: 7, to_bar: 8 },
  ],
  lyric_blocks: [block(1, '[Verse]', 1, 4), block(2, '[Chorus]', 1, 3), block(3, '[Verse 2]', 2, 4)],
  bar_map: [],
  ...over,
});
const bars = { starts: [0, 2, 4, 6, 8, 10, 12, 14], end: 16 };
const sum = (xs: { lines: number }[]) => xs.reduce((n, x) => n + x.lines, 0);

describe('readingLines', () => {
  it("YuE2's own score: the lines are the strip's per-section sum; nothing outside when every block pairs", () => {
    const s = stripSections(facts(), bars, null);
    expect(readingLines(facts(), s, null, true, 99)).toEqual({ lines: sum(s), outside: 0 });
    expect(sum(s)).toBe(11);
  });

  it('Cariñito shape: extra blocks with no section of their kind left are lines outside the sections, not in the total', () => {
    const extra = facts({ lyric_blocks: [
      block(1, '[Verse]', 1, 4), block(2, '[Chorus]', 1, 3), block(3, '[Verse 2]', 2, 4),
      block(4, '[Chorus]', 2, 3), block(5, '[Chorus]', 3, 3), block(6, '[Bridge]', 1, 4),
    ] });
    const s = stripSections(extra, bars, null);
    const r = readingLines(extra, s, null, true, 99);
    expect(r).toEqual({ lines: 14, outside: 7 });
    expect(r.lines).toBe(sum(s));
  });

  it('a section past the audio is not shown, so its block counts outside (D-197)', () => {
    const s = stripSections(facts(), { starts: [0, 2, 4, 6], end: 8 }, null);
    expect(readingLines(facts(), s, null, true, 99)).toEqual({ lines: 7, outside: 4 });
  });

  it('a transcribed score with word timings: a line crossing an edge is counted once; lines before or after every section are outside', () => {
    const words: LyricsReading = { language: 'en', segments: [
      { text: 'a', start: 0.5, end: 1.5, words: [] }, { text: 'b', start: 2.5, end: 4.5, words: [] },
      { text: 'c', start: 5, end: 6, words: [] }, { text: 'd', start: 13, end: 14, words: [] },
      { text: 'tail', start: 16.5, end: 18, words: [] },
    ] };
    const s = stripSections(facts(), bars, words);
    expect(sum(s)).toBe(5); // 'b' crosses verse 1 / chorus 1 and is on both
    expect(readingLines(facts(), s, words, true, 99)).toEqual({ lines: 4, outside: 1 });
  });

  it('a transcribed score with no bar times has no pairing: the words read, nothing outside', () => {
    const words: LyricsReading = { language: 'en', segments: [{ text: 'a', start: 0.5, end: 1.5, words: [] }] };
    const s = stripSections(facts(), null, words);
    expect(readingLines(facts(), s, words, false, 7)).toEqual({ lines: 7, outside: 0 });
  });

  it('no score: the words read, nothing outside', () => {
    expect(readingLines(null, [], null, true, 5)).toEqual({ lines: 5, outside: 0 });
  });
});
