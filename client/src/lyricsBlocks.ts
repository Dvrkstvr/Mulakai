import type { Section } from './lyricSections';

/** A blank-line-delimited block of the stored lyrics text, e.g. a `[Chorus]` block plus its lines. */
export interface LyricsBlock {
  label: string; // tag text without brackets; '' for an untagged lead-in block
  text: string; // the block's raw text (starting with its tag line, if any)
  start: number; // char offset into the source string
  end: number; // char offset into the source string (exclusive)
}

/** Split lyrics text into blank-line-separated blocks, tracking each block's char span. */
export function splitLyricsBlocks(lyrics: string): LyricsBlock[] {
  if (!lyrics.trim()) return [];
  const blocks: LyricsBlock[] = [];
  const sepRe = /\n[ \t]*\n+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const push = (start: number, end: number) => {
    const text = lyrics.slice(start, end);
    if (!text.trim()) return;
    const firstLine = text.split('\n', 1)[0]?.trim() ?? '';
    const tag = firstLine.match(/^\[([^\]]+)\]$/);
    blocks.push({ label: tag ? tag[1].trim() : '', text, start, end });
  };
  while ((match = sepRe.exec(lyrics))) {
    push(cursor, match.index);
    cursor = sepRe.lastIndex;
  }
  push(cursor, lyrics.length);
  return blocks;
}

/**
 * Pair each section (from lyric-timestamp alignment) with the lyrics block
 * sharing its tag label, in order — handles repeated labels (two `[Chorus]`s)
 * by consuming blocks top-down so each is matched at most once.
 */
export function matchSectionBlocks(sections: Section[], blocks: LyricsBlock[]): (LyricsBlock | null)[] {
  const used = new Set<number>();
  return sections.map((s) => {
    const idx = blocks.findIndex((b, i) => !used.has(i) && b.label.toLowerCase() === s.label.toLowerCase());
    if (idx === -1) return null;
    used.add(idx);
    return blocks[idx];
  });
}
