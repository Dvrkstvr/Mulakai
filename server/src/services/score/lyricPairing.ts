/** The one server rule that ties lyric blocks to the score's sections (D-216, D-066 d), yue-server's
 * `score_lyrics.pairs`: the k-th section of a kind sings the k-th block of that kind, where the kind is the tag's
 * or label's first word (`tag_word`: `[Verse 2]` and `verse` are a verse). A section with no such block sings
 * nothing of its own; a block with no such section is extra. Pure. */
import type { LyricBlock, ScoreFacts, ScoreSection } from './planTypes.js';

/** yue-server's tag_word: lower case, first word, `[`, `]` and `:` stripped from both ends. */
export const kindOf = (tagOrLabel: string): string => tagOrLabel.toLowerCase().split(' ')[0].replace(/^[[\]:]+|[[\]:]+$/g, '');

/** section index -> the index of the block it sings, in section order; unpaired sections are absent. */
export function pairBlocks(sections: Array<Pick<ScoreSection, 'index' | 'label'>>, blocks: Array<Pick<LyricBlock, 'index' | 'tag'>>): Map<number, number> {
  const queues = new Map<string, number[]>();
  for (const b of blocks) queues.set(kindOf(b.tag), [...(queues.get(kindOf(b.tag)) ?? []), b.index]);
  const seen = new Map<string, number>();
  const out = new Map<number, number>();
  for (const s of sections) {
    const kind = kindOf(s.label);
    const k = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, k);
    const block = queues.get(kind)?.[k - 1];
    if (block !== undefined) out.set(s.index, block);
  }
  return out;
}

/** The block section S<index> sings, if any. */
export function blockOf(facts: Pick<ScoreFacts, 'sections' | 'lyric_blocks'>, section: number): LyricBlock | undefined {
  const b = pairBlocks(facts.sections, facts.lyric_blocks).get(section);
  return b === undefined ? undefined : facts.lyric_blocks.find((x) => x.index === b);
}

/** The section that sings block <index>, if any. */
export function sectionOf(facts: Pick<ScoreFacts, 'sections' | 'lyric_blocks'>, block: number): ScoreSection | undefined {
  const s = [...pairBlocks(facts.sections, facts.lyric_blocks)].find(([, b]) => b === block)?.[0];
  return s === undefined ? undefined : facts.sections.find((x) => x.index === s);
}
