/** A lyric line as "this" (F-032, M2-1): the Editor's draft line resolved to a lyric block as yue-server read it
 * (GET /score `blocks`; only yue-server reads the score and numbers its blocks, docs/decisions/0002). The client
 * numbers nothing: the draft's j-th tag row stands for the server's j-th tagged block, which must carry the same tag
 * and first line and have the line; the block's number, occurrence and count come from the server. A line no block
 * agrees with (an edited draft, a line outside a tagged block) is `missing`: shown rust, never sent or guessed.
 * No `blocks` (not read yet, or an older server): no pick. Pure. */
import type { ScoreLyricBlock, WordTimings } from './api';
import { alignLyrics } from './lyricAlign';
import type { Section } from './lyricSections';
import { laneLines } from './lyricsLaneLines';
import { kindOf, samePick } from './scoreReferent';
import type { ScorePick } from './scoreVerbTypes';

/** yue-server's block_facts clips a block's first line to this many characters. */
const FIRST_LINE_MAX = 50;
const isTag = (row: string) => row.startsWith('[');

/** Draft line `index` as a pick: a line of a server block, or `missing`; null for a tag or blank row, or while
 * the blocks are not known. */
export function linePick(draft: string, index: number, blocks: ScoreLyricBlock[] | undefined): ScorePick | null {
  const rows = draft.split('\n').map((r) => r.trim());
  const text = rows[index];
  if (!blocks || !text || isTag(text)) return null;
  const missing: ScorePick = { kind: 'missing', label: text, line: true };
  let tagRow = index - 1;
  while (tagRow >= 0 && !isTag(rows[tagRow])) tagRow--;
  if (tagRow < 0) return missing;
  const nth = rows.slice(0, tagRow + 1).filter(isTag).length;
  const b = blocks.filter((x) => x.tag)[nth - 1];
  const lyric = rows.slice(tagRow + 1, index + 1).filter(Boolean);
  if (!b || b.tag.trim() !== rows[tagRow] || b.first_line !== lyric[0].slice(0, FIRST_LINE_MAX) || lyric.length > b.lines) return missing;
  const of = blocks.filter((x) => x.tag && kindOf(x.tag) === kindOf(b.tag)).length;
  return { kind: 'line', block: b.index, tag: b.tag, occurrence: b.occurrence, of, line: lyric.length, text };
}

/** The draft line a line pick stands on, for its sky echo; -1 for none. */
export function lineIndexOf(draft: string, pick: ScorePick | null, blocks: ScoreLyricBlock[] | undefined): number {
  if (pick?.kind !== 'line' || !blocks) return -1;
  const rows = draft.split('\n');
  return rows.findIndex((_, i) => {
    const p = linePick(draft, i, blocks);
    return p?.kind === 'line' && samePick(p, pick);
  });
}

/** Whether SCORE has anything to pick (D-074): a section on the strip or a lyric line the lane shows at its time. */
export function canPick(strip: Section[], draft: string, timings: WordTimings | null): boolean {
  return strip.length > 0 || (!!timings && laneLines(draft, alignLyrics(draft, timings).lines).lines.length > 0);
}
