import { describe, expect, it } from 'vitest';
import { matchSectionBlocks, splitLyricsBlocks } from './lyricsBlocks';
import { coveredSections, spanText, spliceWords, wordsSpan } from './sectionWords';

const TEXT = '[Verse 1]\nFeel the rhythm\nNeon lights\n\n[Chorus]\nNeon pulse\n\n[Verse 2]\nThe shadows fade\nWe rise again';
const SECTIONS = [{ label: 'Verse 1', start: 0, end: 30 }, { label: 'Chorus', start: 30, end: 50 }, { label: 'Verse 2', start: 50, end: 80 }];
const matched = matchSectionBlocks(SECTIONS, splitLyricsBlocks(TEXT));

describe('coveredSections', () => {
  it('a section at least half inside the selection, or the one a small selection sits in', () => {
    expect(coveredSections(SECTIONS, { start: 50, end: 80 })).toEqual([2]);
    expect(coveredSections(SECTIONS, { start: 55, end: 60 })).toEqual([2]);
    expect(coveredSections(SECTIONS, { start: 28, end: 80 })).toEqual([1, 2]);
    expect(coveredSections(SECTIONS, null)).toEqual([]);
  });
});

describe('wordsSpan', () => {
  it('one section: its lines, without its own tag line', () => {
    const span = wordsSpan(TEXT, matched, [2])!;
    expect(span.label).toBe('VERSE 2');
    expect(spanText(TEXT, span)).toBe('The shadows fade\nWe rise again');
  });

  it('several: from the first lines to the last block, inner tags kept', () => {
    const span = wordsSpan(TEXT, matched, [1, 2])!;
    expect(span.label).toBe('CHORUS – VERSE 2');
    expect(spanText(TEXT, span)).toBe('Neon pulse\n\n[Verse 2]\nThe shadows fade\nWe rise again');
  });

  it('no matched block: nothing to edit', () => {
    expect(wordsSpan(TEXT, [null, null, null], [0])).toBeNull();
  });
});

describe('spliceWords', () => {
  it('writes the edit back in place, the tags and other sections untouched', () => {
    const span = wordsSpan(TEXT, matched, [2])!;
    const next = spliceWords(TEXT, span, 'The shadows fade\nThrough neon rain');
    expect(next).toBe(TEXT.replace('We rise again', 'Through neon rain'));
  });
});
