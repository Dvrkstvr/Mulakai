/** The rail's LYRICS tab (PLAN.md "Editor Redesign", PR 6): the song's lyrics as blocks, each with the section it was
 * heard as (its time, so a click selects it) and whether the selection sits in it. Pure. */
import type { Section } from './lyricSections';
import type { LyricsBlock } from './lyricsBlocks';
import type { Region } from './Waveform';

export interface RailLyricsRow {
  /** `[Verse 2]`'s label, or '' for an untagged lead-in. */
  label: string;
  lines: string[];
  /** The heard section's span: a click selects it. Null when the block wasn't heard (not timed yet, or skipped). */
  region: Region | null;
  /** The selection sits in this block's section. */
  active: boolean;
}

/** One row per lyrics block, in the text's order, with its matched section (`matchSectionBlocks`). */
export function railLyricsRows(blocks: LyricsBlock[], sections: Section[], matched: (LyricsBlock | null)[], activeIndex: number): RailLyricsRow[] {
  return blocks.map((b) => {
    const i = matched.indexOf(b);
    const s = i === -1 ? null : sections[i];
    const lines = b.text.split('\n').map((l) => l.trim()).filter((l, n) => l && !(n === 0 && /^\[[^\]]+\]$/.test(l)));
    return { label: b.label, lines, region: s ? { start: s.start, end: s.end } : null, active: i !== -1 && i === activeIndex };
  });
}
