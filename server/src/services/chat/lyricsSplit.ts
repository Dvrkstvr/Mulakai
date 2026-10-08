/**
 * A version's stored lyrics as the score's lyric blocks (F-056, D-217), pure: yue-server's `parse_blocks`
 * (`score_lyrics.py`) in TypeScript, kept to its rules: blocks are runs of non-blank rows (a blank or
 * whitespace-only row separates them), rows are trimmed, a block's first row is its tag when it starts with `[`,
 * else the block is untagged (tag `""`) and every row is a line. Each line keeps its index in `text.split('\n')`,
 * the index the client's `alignLyrics` times. `checkBlocks` is D-072's check against the read's `lyric_blocks`
 * (tag, line count, first line cut to 50 characters): a mismatch is a reason, never a guess.
 */
import type { LyricBlock } from '../score/planTypes.js';

export interface SplitLine { text: string; textLine: number }
export interface SplitBlock { index: number; tag: string; lines: SplitLine[] }

export function splitLyrics(text: string): SplitBlock[] {
  const blocks: SplitBlock[] = [];
  let run: SplitLine[] = [];
  const close = () => {
    if (run.length === 0) return;
    const tagged = run[0].text.startsWith('[');
    blocks.push({ index: blocks.length + 1, tag: tagged ? run[0].text : '', lines: tagged ? run.slice(1) : run });
    run = [];
  };
  text.split('\n').forEach((row, textLine) => {
    const t = row.trim();
    if (t) run.push({ text: t, textLine });
    else close();
  });
  close();
  return blocks;
}

/** yue-server cuts `first_line` to 50 code points (a Python slice). */
const first50 = (s: string) => Array.from(s).slice(0, 50).join('');

/** Null when the stored blocks are the score's; else what differs, for the panel's note. */
export function checkBlocks(blocks: SplitBlock[], facts: LyricBlock[]): string | null {
  if (blocks.length !== facts.length) return `the stored lyrics have ${blocks.length} blocks, the score has ${facts.length}`;
  for (const [i, f] of facts.entries()) {
    const b = blocks[i];
    const name = `block ${f.index} ${f.tag || '(untagged)'}`;
    if (b.index !== f.index || b.tag !== f.tag) return `${name}: the stored lyrics tag it ${b.tag || '(untagged)'}`;
    if (b.lines.length !== f.lines) return `${name}: ${b.lines.length} stored lines, the score has ${f.lines}`;
    if (first50(b.lines[0]?.text ?? '') !== f.first_line) return `${name}: its first line differs from the score's`;
  }
  return null;
}
