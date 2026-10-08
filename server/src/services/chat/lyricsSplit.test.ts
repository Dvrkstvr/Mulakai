/** Stored lyrics → tagged blocks with each line's index in the text (yue-server `parse_blocks`), checked against the
 * score's `lyric_blocks` by tag, line count and first line (D-072, D-217). The contract song is the one
 * yue-server read for `read-sections.json`. */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { checkBlocks, splitLyrics } from './lyricsSplit.js';
import type { ScoreFacts } from '../score/planTypes.js';

const read = contract('read-sections');
const lyrics = read.request.body.lyrics as string;
const facts = read.response.body.facts as ScoreFacts;

describe('splitLyrics', () => {
  it("splits the contract song into yue-server's blocks: same tags, line counts and first lines", () => {
    const blocks = splitLyrics(lyrics);
    expect(blocks.map((b) => [b.index, b.tag, b.lines.length, b.lines[0].text]))
      .toEqual(facts.lyric_blocks.map((b) => [b.index, b.tag, b.lines, b.first_line]));
    expect(checkBlocks(blocks, facts.lyric_blocks)).toBeNull();
  });

  it("each line's textLine is its index in text.split('\\n') (what the client's alignLyrics indexes)", () => {
    const rows = lyrics.split('\n');
    for (const b of splitLyrics(lyrics)) for (const l of b.lines) expect(rows[l.textLine].trim()).toBe(l.text);
    expect(splitLyrics(lyrics)[4]).toMatchObject({ tag: '[Chorus]', lines: [{ text: 'chorus 5 line 1', textLine: 30 }, { textLine: 31 }, { textLine: 32 }, { textLine: 33 }] });
  });

  it('an untagged lead-in is a block with tag "" and all its rows as lines; blank and whitespace rows separate blocks', () => {
    const blocks = splitLyrics('\n\nhey\n  ho  \n \t \n\n[Verse]\na\nb\n');
    expect(blocks).toEqual([
      { index: 1, tag: '', lines: [{ text: 'hey', textLine: 2 }, { text: 'ho', textLine: 3 }] },
      { index: 2, tag: '[Verse]', lines: [{ text: 'a', textLine: 7 }, { text: 'b', textLine: 8 }] },
    ]);
  });

  it('a tag with no lines is a block of 0 lines; empty text is no blocks', () => {
    expect(splitLyrics('[Intro]\n\n[Verse]\nx')).toMatchObject([{ tag: '[Intro]', lines: [] }, { tag: '[Verse]', lines: [{ text: 'x' }] }]);
    expect(splitLyrics('  \n\n')).toEqual([]);
  });
});

describe('checkBlocks (D-072: tag, line count, first line)', () => {
  const blocks = () => splitLyrics(lyrics);
  it('a different block count is a mismatch', () => {
    expect(checkBlocks(blocks().slice(0, 6), facts.lyric_blocks)).toMatch(/6 blocks, the score has 7/);
  });
  it('a different tag, line count or first line names the block', () => {
    expect(checkBlocks(splitLyrics(lyrics.replace('[Bridge]', '[Solo]')), facts.lyric_blocks)).toMatch(/block 6/);
    expect(checkBlocks(splitLyrics(lyrics.replace('bridge 6 line 2\n', '')), facts.lyric_blocks)).toMatch(/block 6/);
    expect(checkBlocks(splitLyrics(lyrics.replace('chorus 5 line 1', 'chorus five')), facts.lyric_blocks)).toMatch(/block 5/);
  });
  it('the first line is compared on its first 50 characters, as yue-server cuts it', () => {
    const long = 'x'.repeat(60);
    const own = splitLyrics(`[Verse]\n${long}`);
    expect(checkBlocks(own, [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 1, first_line: 'x'.repeat(50) }])).toBeNull();
  });
});
