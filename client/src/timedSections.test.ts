import { describe, it, expect } from 'vitest';
import type { LyricAlignment } from './lyricAlign';
import { alignedLyricLines, sectionTimings, LEAD_IN_SECONDS } from './timedSections';
import { groupSections } from './lyricSections';

const span = (start: number, end: number) => ({ start, end });

// [Intro] / [Piano melody] / [Verse 1] two lines / [Chorus] one line / [Outro] wordless.
const LYRICS = '[Intro]\n[Piano melody]\n\n[Verse 1]\nMidnight city\nNeon signs\n\n[Chorus]\nIn the shadows\n\n[Outro]';
const ALIGNED: LyricAlignment = {
  lines: [null, null, null, null, span(21, 23.4), span(25.8, 29.3), null, null, span(46, 50.5), null, null],
  matched: 1,
};

describe('alignedLyricLines', () => {
  it('starts tags where the previous sung line ended, a wordless run giving way a lead-in early', () => {
    expect(alignedLyricLines(LYRICS, ALIGNED, 70)).toEqual([
      { text: '[Intro]', start: 0, end: 0 },
      { text: '[Piano melody]', start: 20, end: 20 },
      { text: '[Verse 1]', start: 21 - LEAD_IN_SECONDS, end: 21 - LEAD_IN_SECONDS },
      { text: 'Midnight city', start: 21, end: 23.4 },
      { text: 'Neon signs', start: 25.8, end: 29.3 },
      { text: '[Chorus]', start: 29.3, end: 29.3 },
      { text: 'In the shadows', start: 46, end: 50.5 },
      { text: '[Outro]', start: 50.5, end: 50.5 },
    ]);
  });

  it('feeds groupSections a strip where the intro spans the intro and the second wordless tag drops out', () => {
    expect(groupSections(alignedLyricLines(LYRICS, ALIGNED, 70), 70)).toEqual([
      { label: 'Intro', start: 0, end: 20 },
      { label: 'Verse 1', start: 20, end: 29.3 },
      { label: 'Chorus', start: 29.3, end: 50.5 },
      { label: 'Outro', start: 50.5, end: 70 },
    ]);
  });

  it('never starts a sung section before the previous line ended, even with a short gap', () => {
    const lines = alignedLyricLines('Midnight\n[Break]\n[Verse]\nNeon', {
      lines: [span(10, 12), null, null, span(12.4, 14)], matched: 1,
    }, 20);
    expect(lines.find((l) => l.text === '[Verse]')?.start).toBe(12);
  });

  it('gives a trailing wordless run the whole tail, the rest of it sitting at the end', () => {
    const lines = alignedLyricLines('[Outro]\nIn the shadows\n[Humming]\n[Humming]\n[repeat]', {
      lines: [null, span(154, 168), null, null, null], matched: 1,
    }, 207);
    expect(groupSections(lines, 207)).toEqual([
      { label: 'Outro', start: 0, end: 168 },
      { label: 'Humming', start: 168, end: 207 },
    ]);
  });

  it('skips untimed lines but keeps every tag', () => {
    const lines = alignedLyricLines('[Verse]\n(Mmm)\nLost inside', { lines: [null, null, span(38, 42)], matched: 0.7 }, 60);
    expect(lines.map((l) => l.text)).toEqual(['[Verse]', 'Lost inside']);
  });
});

describe('sectionTimings', () => {
  const ace = [{ text: '[Verse]', start: 0.6, end: 0.9 }];

  it('prefers the reading once it heard at least half the words', () => {
    expect(sectionTimings(ace, LYRICS, ALIGNED, 70)?.[0]).toEqual({ text: '[Intro]', start: 0, end: 0 });
  });

  it("falls back to ACE-Step's timings when the reading heard too little", () => {
    expect(sectionTimings(ace, LYRICS, { ...ALIGNED, matched: 0.4 }, 70)).toBe(ace);
  });

  it('uses a weak reading when there is nothing else, and null when there is nothing at all', () => {
    expect(sectionTimings(null, LYRICS, { ...ALIGNED, matched: 0.4 }, 70)?.length).toBe(8);
    expect(sectionTimings(null, LYRICS, null, 70)).toBeNull();
    expect(sectionTimings(ace, LYRICS, null, 70)).toBe(ace);
  });
});
