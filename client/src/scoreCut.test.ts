import { describe, it, expect } from 'vitest';
import { keptTokens, largestKept, sizeFits, splitScore, sungScore, toggleSection } from './scoreCut';

const HEADER = 'X:1\nM:4/4\nQ:1/4=145\nV: Vocal\nV: Ins\nK:Eb\n';
const INTRO = '% intro\nV: Vocal\nZ4|\nV: Ins\nE2E2|\n';
const VERSE = '% verse\nV: Vocal\nG4|\nV: Ins\nZ|\n';
const OUTRO = '% outro\nV: Vocal\nZ|\nV: Ins\nZ|';
const ABC = HEADER + INTRO + VERSE + OUTRO;
// The failing 7:47 score's real counts (PLAN.md "YuE2 Covers: Pick the Score's Sections").
const SIZE = {
  budget: 4096, header: 73,
  sections: [
    { name: 'intro', tokens: 646 }, { name: 'verse', tokens: 424 }, { name: 'chorus', tokens: 183 },
    { name: 'interlude', tokens: 1594 }, { name: 'bridge', tokens: 107 }, { name: 'chorus', tokens: 442 },
    { name: 'outro', tokens: 1563 },
  ],
};

describe('splitScore', () => {
  it('splits at % lines, names sections as scoreSections does, and keeps every byte', () => {
    const { header, sections } = splitScore(ABC);
    expect(header).toBe(HEADER);
    expect(sections).toEqual([{ name: 'Intro', text: INTRO }, { name: 'Verse', text: VERSE }, { name: 'Outro', text: OUTRO }]);
    expect(header + sections.map((s) => s.text).join('')).toBe(ABC);
  });

  it('keeps CRLF line endings, and reads a score without sections as all header', () => {
    const crlf = ABC.replace(/\n/g, '\r\n');
    const { header, sections } = splitScore(crlf);
    expect(header + sections.map((s) => s.text).join('')).toBe(crlf);
    expect(splitScore('X:1\nK:C\n|C4|\n')).toEqual({ header: 'X:1\nK:C\n|C4|\n', sections: [] });
  });
});

describe('sungScore', () => {
  it('is the score itself until a section is left out', () => {
    expect(sungScore({ abc: ABC })).toBe(ABC);
    expect(sungScore({ abc: ABC, dropped: [] })).toBe(ABC);
  });

  it('leaves out the dropped sections, keeping the header', () => {
    expect(sungScore({ abc: ABC, dropped: [2] })).toBe(HEADER + INTRO + VERSE);
    expect(sungScore({ abc: ABC, dropped: [0, 2] })).toBe(HEADER + VERSE);
  });
});

describe('token sums', () => {
  it('adds the header and the kept sections', () => {
    expect(keptTokens(SIZE)).toBe(5032);
    expect(keptTokens(SIZE, [6])).toBe(3469); // without the outro: what fits
  });

  it('names the largest kept sections, largest first', () => {
    expect(largestKept(SIZE)).toEqual(['interlude', 'outro']);
    expect(largestKept(SIZE, [3])).toEqual(['outro', 'intro']);
  });

  it('only trusts a size measured for this score', () => {
    expect(sizeFits(ABC, { budget: 4096, header: 1, sections: [{ name: 'intro', tokens: 1 }] })).toBe(false);
    expect(sizeFits(ABC, { budget: 4096, header: 1, sections: SIZE.sections.slice(0, 3) })).toBe(true);
    expect(sizeFits(ABC, null)).toBe(false);
  });
});

describe('toggleSection', () => {
  it('leaves a section out and back in, sorted', () => {
    expect(toggleSection(3, [], 2)).toEqual([2]);
    expect(toggleSection(3, [2], 0)).toEqual([0, 2]);
    expect(toggleSection(3, [0, 2], 2)).toEqual([0]);
  });

  it('never leaves nothing to sing', () => {
    expect(toggleSection(3, [0, 2], 1)).toEqual([0, 2]);
    expect(toggleSection(1, [], 0)).toEqual([]);
  });
});
