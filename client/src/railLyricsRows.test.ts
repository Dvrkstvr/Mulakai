import { describe, expect, it } from 'vitest';
import { matchSectionBlocks, splitLyricsBlocks } from './lyricsBlocks';
import { railLyricsRows } from './railLyricsRows';

const LYRICS = '[Verse 1]\nFeel the rhythm\nNeon lights\n\n[Chorus]\nNeon pulse\n\n[Bridge]\nThe world is spinning';
const SECTIONS = [{ label: 'Verse 1', start: 17, end: 51 }, { label: 'Chorus', start: 51, end: 77 }];

describe('railLyricsRows', () => {
  const blocks = splitLyricsBlocks(LYRICS);
  const rows = railLyricsRows(blocks, SECTIONS, matchSectionBlocks(SECTIONS, blocks), 1);

  it('one row per block, its lines without the tag line', () => {
    expect(rows.map((r) => r.label)).toEqual(['Verse 1', 'Chorus', 'Bridge']);
    expect(rows[0].lines).toEqual(['Feel the rhythm', 'Neon lights']);
  });

  it("a heard block carries its section's span; the one the selection sits in is active", () => {
    expect(rows[1]).toMatchObject({ region: { start: 51, end: 77 }, active: true });
    expect(rows[0].active).toBe(false);
  });

  it('a block not heard has no span to select', () => {
    expect(rows[2].region).toBeNull();
  });
});
