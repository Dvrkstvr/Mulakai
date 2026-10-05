/** A lyric line as "this" (F-032): the draft line resolved to a block of GET /score's `blocks` (yue-server's
 * numbering), or not addressable when no block agrees; never counted by the client. */
import { describe, expect, it } from 'vitest';
import type { ScoreLyricBlock } from './api';
import { canPick, lineIndexOf, linePick } from './scoreLinePick';

const DRAFT = '[Verse 1]\nWalking down\nthe road\n\n[Chorus]\nHold the light\nCopper skies are burning low\n\n[Verse 2]\nAgain\n\n[Chorus]\nHold the light\nCarry me back';
/** As yue-server reads DRAFT (block_facts). */
const BLOCKS: ScoreLyricBlock[] = [
  { index: 1, tag: '[Verse 1]', occurrence: 1, lines: 2, first_line: 'Walking down' },
  { index: 2, tag: '[Chorus]', occurrence: 1, lines: 2, first_line: 'Hold the light' },
  { index: 3, tag: '[Verse 2]', occurrence: 2, lines: 1, first_line: 'Again' },
  { index: 4, tag: '[Chorus]', occurrence: 2, lines: 2, first_line: 'Hold the light' },
];

describe('linePick', () => {
  it('takes the block number, tag and occurrence from the server, the line within it from the draft', () => {
    expect(linePick(DRAFT, 6, BLOCKS)).toEqual({ kind: 'line', block: 2, tag: '[Chorus]', occurrence: 1, of: 2, line: 2, text: 'Copper skies are burning low' });
    expect(linePick(DRAFT, 13, BLOCKS)).toMatchObject({ block: 4, occurrence: 2, of: 2, line: 2, text: 'Carry me back' });
    expect(linePick(DRAFT, 9, BLOCKS)).toMatchObject({ block: 3, tag: '[Verse 2]', occurrence: 2, of: 2, line: 1 });
  });

  it('uses the server numbering, not a count: an untagged block the server numbers shifts the block number', () => {
    const blocks = [{ index: 1, tag: '', occurrence: 1, lines: 1, first_line: 'spoken' }, ...BLOCKS.map((b) => ({ ...b, index: b.index + 1 }))];
    expect(linePick(`spoken\n\n${DRAFT}`, 15, blocks)).toMatchObject({ block: 5, tag: '[Chorus]', occurrence: 2, line: 2 });
  });

  it('a tag, a blank line, or blocks not known yet: no pick', () => {
    expect(linePick(DRAFT, 0, BLOCKS)).toBeNull();
    expect(linePick(DRAFT, 3, BLOCKS)).toBeNull();
    expect(linePick(DRAFT, 6, undefined)).toBeNull();
  });

  it('a line no server block agrees with is not addressable: shown, never sent, never guessed', () => {
    const missing = { kind: 'missing', label: 'Carry me back', line: true };
    // The draft was edited since the score was read: the block's first line differs.
    expect(linePick(DRAFT.replace('Hold the light\nCarry', 'Hold the night\nCarry'), 13, BLOCKS)).toEqual(missing);
    // The draft has a line the score's block does not (the server's block is shorter).
    expect(linePick(DRAFT, 13, BLOCKS.map((b) => (b.index === 4 ? { ...b, lines: 1 } : b)))).toEqual(missing);
    // The score has fewer tagged blocks than the draft.
    expect(linePick(DRAFT, 13, BLOCKS.slice(0, 3))).toEqual(missing);
    // An untagged block's line, and a line after a blank inside a tagged section, belong to no tagged block.
    expect(linePick('just words\nmore words', 1, BLOCKS)).toEqual({ kind: 'missing', label: 'more words', line: true });
    expect(linePick('[Chorus]\nHold the light\nCopper skies\n\nstray', 4, BLOCKS)).toEqual({ kind: 'missing', label: 'stray', line: true });
  });

  it('a tag in the middle of a block (no blank line before it) is a line to yue-server: the blocks disagree', () => {
    const blocks: ScoreLyricBlock[] = [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 3, first_line: 'a' }];
    expect(linePick('[Verse]\na\n[Chorus]\nb', 3, blocks)).toEqual({ kind: 'missing', label: 'b', line: true });
  });

  it('matches a first line as yue-server clips it (50 characters)', () => {
    const long = 'x'.repeat(60);
    const blocks: ScoreLyricBlock[] = [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 1, first_line: long.slice(0, 50) }];
    expect(linePick(`[Verse]\n${long}`, 1, blocks)).toMatchObject({ kind: 'line', block: 1, line: 1 });
  });
});

describe('lineIndexOf', () => {
  it('finds the draft line a line pick stands on, for the sky echo', () => {
    expect(lineIndexOf(DRAFT, linePick(DRAFT, 13, BLOCKS), BLOCKS)).toBe(13);
    expect(lineIndexOf(DRAFT, linePick(DRAFT, 6, BLOCKS), BLOCKS)).toBe(6);
  });
  it('none for no pick, a section pick, a missing line or unknown blocks', () => {
    expect(lineIndexOf(DRAFT, null, BLOCKS)).toBe(-1);
    expect(lineIndexOf(DRAFT, { kind: 'missing', label: 'x', line: true }, BLOCKS)).toBe(-1);
    expect(lineIndexOf(DRAFT, { kind: 'section', section: 1, label: 'verse', occurrence: 1, bars: [1, 4] }, BLOCKS)).toBe(-1);
    expect(lineIndexOf(DRAFT, linePick(DRAFT, 13, BLOCKS), undefined)).toBe(-1);
  });
});

describe('canPick (D-074)', () => {
  const timed = (text: string, at: number) => ({ language: 'en', segments: [{ text, start: at, end: at + 2,
    words: text.split(' ').map((t, i) => ({ text: t, start: at + i, end: at + i + 1 })) }] });
  it('is true with a strip section or a timed lyric line, false with neither', () => {
    expect(canPick([{ label: 'Chorus', start: 0, end: 10 }], '', null)).toBe(true);
    expect(canPick([], DRAFT, timed('Walking down', 3))).toBe(true);
    expect(canPick([], DRAFT, null)).toBe(false); // no lyric timings yet: nothing to click
    expect(canPick([], DRAFT, { language: 'en', segments: [] })).toBe(false); // read, but no line was heard
    expect(canPick([], '', timed('Walking down', 3))).toBe(false); // no lyrics
  });
});
