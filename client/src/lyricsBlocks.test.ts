import { describe, it, expect } from 'vitest';
import { splitLyricsBlocks, matchSectionBlocks } from './lyricsBlocks';
import type { Section } from './lyricSections';

const section = (label: string, start: number, end: number): Section => ({ label, start, end });

describe('splitLyricsBlocks', () => {
  it('returns [] for empty/whitespace-only text', () => {
    expect(splitLyricsBlocks('')).toEqual([]);
    expect(splitLyricsBlocks('   \n\n  ')).toEqual([]);
  });

  it('splits on blank lines and tracks char offsets', () => {
    const lyrics = '[Verse]\nfirst line\nsecond line\n\n[Chorus]\nhook line';
    const blocks = splitLyricsBlocks(lyrics);
    expect(blocks.map((b) => b.label)).toEqual(['Verse', 'Chorus']);
    expect(blocks[0].text).toBe(lyrics.slice(blocks[0].start, blocks[0].end));
    expect(blocks[1].text).toBe(lyrics.slice(blocks[1].start, blocks[1].end));
    expect(lyrics.slice(blocks[0].start, blocks[0].end)).toBe('[Verse]\nfirst line\nsecond line');
    expect(lyrics.slice(blocks[1].start, blocks[1].end)).toBe('[Chorus]\nhook line');
  });

  it('gives an untagged lead-in block an empty label', () => {
    const blocks = splitLyricsBlocks('la la la\n\n[Verse]\nwords');
    expect(blocks.map((b) => b.label)).toEqual(['', 'Verse']);
  });

  it('handles blank separators with trailing whitespace', () => {
    const blocks = splitLyricsBlocks('[Verse]\nline one\n  \n[Chorus]\nline two');
    expect(blocks.map((b) => b.label)).toEqual(['Verse', 'Chorus']);
  });
});

describe('matchSectionBlocks', () => {
  it('pairs sections to blocks by tag label, in order', () => {
    const blocks = splitLyricsBlocks('[Verse]\na\n\n[Chorus]\nb\n\n[Verse 2]\nc');
    const sections = [section('Verse', 0, 10), section('Chorus', 10, 20), section('Verse 2', 20, 30)];
    const matched = matchSectionBlocks(sections, blocks);
    expect(matched.map((b) => b?.label)).toEqual(['Verse', 'Chorus', 'Verse 2']);
  });

  it('consumes each block at most once for repeated labels', () => {
    const blocks = splitLyricsBlocks('[Verse]\na\n\n[Chorus]\nb\n\n[Chorus]\nc');
    const sections = [section('Chorus', 0, 10), section('Chorus', 10, 20)];
    const matched = matchSectionBlocks(sections, blocks);
    expect(matched[0]).not.toBe(matched[1]);
    expect(matched[0]?.text).toBe('[Chorus]\nb');
    expect(matched[1]?.text).toBe('[Chorus]\nc');
  });

  it('returns null when no block matches a section label', () => {
    const blocks = splitLyricsBlocks('[Verse]\na');
    const matched = matchSectionBlocks([section('Bridge', 0, 10)], blocks);
    expect(matched).toEqual([null]);
  });
});
