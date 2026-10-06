import { describe, expect, it } from 'vitest';
import type { ChatLyricSection } from './api/chat';
import { lyricsPreview, parseStructure, sectionsToText, structureText, textToSections } from './chatLyricsText';

const S: ChatLyricSection[] = [
  { tag: 'Verse', lines: ['La sal en tu piel', 'el viento sin nombre'] },
  { tag: 'Chorus', lines: ['Luz sobre el mar'] },
  { tag: 'Verse', lines: ['otra vez'] },
];

describe('sectionsToText', () => {
  it('writes a header per section, numbering a tag that repeats, a blank line between', () => {
    expect(sectionsToText(S)).toBe('[Verse 1]\nLa sal en tu piel\nel viento sin nombre\n\n[Chorus]\nLuz sobre el mar\n\n[Verse 2]\notra vez');
  });
  it('no sections: empty text', () => expect(sectionsToText([])).toBe(''));
});

describe('textToSections', () => {
  it('round-trips what sectionsToText wrote', () => {
    expect(textToSections(sectionsToText(S))).toEqual({ sections: S, problems: [] });
  });
  it('reads headers in any case, with or without a number, and Pre-Chorus spelled loosely', () => {
    const r = textToSections('[verse]\na\n[PRE-CHORUS 2]\nb\n[prechorus]\nc\n[ Bridge ]\nd');
    expect(r.problems).toEqual([]);
    expect(r.sections.map((s) => s.tag)).toEqual(['Verse', 'Pre-Chorus', 'Pre-Chorus', 'Bridge']);
  });
  it('drops blank lines and trims each line', () => {
    expect(textToSections('[Chorus]\n\n  la la  \n\n').sections).toEqual([{ tag: 'Chorus', lines: ['la la'] }]);
  });
  it('keeps a header with no lines (the server judges it)', () => {
    expect(textToSections('[Outro]').sections).toEqual([{ tag: 'Outro', lines: [] }]);
  });
  it('a line before any header is a problem, not a guess', () => {
    const r = textToSections('hello\n[Verse]\nx');
    expect(r.problems).toEqual(['line 1 is outside a section: put [Verse] or [Chorus] above it']);
  });
  it('a header YuE2 does not sing is a problem naming the ones it does', () => {
    expect(textToSections('[Hook]\nx').problems[0]).toBe('[Hook] is not a sung section: use Verse, Pre-Chorus, Chorus, Bridge or Outro');
    expect(textToSections('[Intro]\nx').problems).toHaveLength(1);
  });
  it('empty text: no sections, no problem (instrumental)', () => {
    expect(textToSections('  \n')).toEqual({ sections: [], problems: [] });
  });
});

describe('structure', () => {
  it('writes and reads the section order', () => {
    expect(structureText(['Intro', 'Verse', 'Pre-Chorus', 'Chorus'])).toBe('INTRO · VERSE · PRE-CHORUS · CHORUS');
    expect(parseStructure('INTRO · VERSE · PRE-CHORUS · CHORUS')).toEqual({ tags: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus'], problems: [] });
  });
  it('accepts commas and spaces, any case', () => {
    expect(parseStructure('intro, verse chorus,outro').tags).toEqual(['Intro', 'Verse', 'Chorus', 'Outro']);
  });
  it('an unknown name is a problem', () => {
    expect(parseStructure('verse solo').problems).toEqual(['SOLO is not a section: use Intro, Verse, Pre-Chorus, Chorus, Bridge or Outro']);
  });
});

describe('lyricsPreview', () => {
  it('first header and line, then the count', () => {
    expect(lyricsPreview(S)).toEqual({ head: '[Verse 1]', first: 'La sal en tu piel', count: 4 });
  });
  it('none: null', () => expect(lyricsPreview([])).toBeNull());
});
