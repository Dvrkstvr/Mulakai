import { describe, it, expect } from 'vitest';
import { groupSections, findActiveSectionIndex } from './lyricSections';
import type { LyricLine } from './api';

const line = (start: number, end: number, text: string): LyricLine => ({ start, end, text });

describe('groupSections', () => {
  it('returns [] for empty, null, or zero-duration input', () => {
    expect(groupSections(null, 60)).toEqual([]);
    expect(groupSections([], 60)).toEqual([]);
    expect(groupSections([line(0, 2, '[Verse]')], 0)).toEqual([]);
  });

  it('splits on bracketed tag lines and tiles the whole track', () => {
    const lines = [
      line(1, 2, '[Verse 1]'),
      line(2, 6, 'first lyric line'),
      line(6, 10, 'second lyric line'),
      line(11, 12, '[Chorus]'),
      line(12, 18, 'hook line'),
    ];
    const sections = groupSections(lines, 30);
    expect(sections).toEqual([
      { label: 'Verse 1', start: 0, end: 11 },
      { label: 'Chorus', start: 11, end: 30 },
    ]);
  });

  it('treats untagged lead-in lines as a single label-less section', () => {
    const sections = groupSections([line(3, 5, 'la la la'), line(5, 8, 'na na na')], 12);
    expect(sections).toEqual([{ label: '', start: 0, end: 12 }]);
  });

  it('keeps a lead-in section before the first tag', () => {
    const sections = groupSections(
      [line(2, 4, 'intro hum'), line(5, 6, '[Verse]'), line(6, 9, 'words')],
      20,
    );
    expect(sections).toEqual([
      { label: '', start: 0, end: 5 },
      { label: 'Verse', start: 5, end: 20 },
    ]);
  });

  it('does not treat a lyric line that merely contains brackets as a tag', () => {
    const sections = groupSections(
      [line(1, 2, '[Verse]'), line(2, 5, 'meet me [at the door]')],
      10,
    );
    expect(sections).toEqual([{ label: 'Verse', start: 0, end: 10 }]);
  });

  it('drops zero-width middle sections from coincident tag times', () => {
    const sections = groupSections(
      [line(2, 3, '[Verse]'), line(7, 8, '[Bridge]'), line(7, 8, '[Chorus]'), line(8, 11, 'sing')],
      15,
    );
    // [Bridge] and [Chorus] share a start, so [Bridge] collapses to zero width and is dropped.
    expect(sections).toEqual([
      { label: 'Verse', start: 0, end: 7 },
      { label: 'Chorus', start: 7, end: 15 },
    ]);
  });
});

describe('findActiveSectionIndex', () => {
  const sections = [
    { label: 'Verse', start: 0, end: 11 },
    { label: 'Chorus', start: 11, end: 30 },
  ];

  it('returns -1 for a null selection', () => {
    expect(findActiveSectionIndex(sections, null)).toBe(-1);
  });

  it('returns the matching index for an exact span', () => {
    expect(findActiveSectionIndex(sections, { start: 11, end: 30 })).toBe(1);
  });

  it('tolerates tiny floating-point drift', () => {
    expect(findActiveSectionIndex(sections, { start: 11.02, end: 29.98 })).toBe(1);
  });

  it('returns -1 for a manually adjusted/partial region', () => {
    expect(findActiveSectionIndex(sections, { start: 12, end: 25 })).toBe(-1);
  });
});
