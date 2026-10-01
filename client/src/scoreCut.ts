/** Leaving whole sections out of a cover's score (PLAN.md "YuE2 Covers: Pick the Score's
 * Sections"). A score is its header plus `% name` blocks — the rule `scoreSections` and
 * yue-server's `split_sections` share — so a cut is the header plus the blocks kept. Pure. */
import type { ScoreSize } from './api';
import { scoreSections } from './coverLyrics';

export interface ScorePart {
  name: string;
  text: string;
}

/** The header (everything before the first `% name` line) and each section's block, in order.
 * Joined back together they are the score, byte for byte. */
export function splitScore(abc: string): { header: string; sections: ScorePart[] } {
  const names = scoreSections(abc);
  let header = '';
  const sections: ScorePart[] = [];
  for (const line of abc.split(/(?<=\n)/)) {
    if (line.startsWith('% ')) sections.push({ name: names[sections.length], text: line });
    else if (sections.length) sections[sections.length - 1].text += line;
    else header += line;
  }
  return { header, sections };
}

/** The score as it will be sung: without the sections at `dropped` (indexes into its sections). */
export function sungScore({ abc, dropped }: { abc: string; dropped?: number[] }): string {
  if (!dropped?.length) return abc;
  const { header, sections } = splitScore(abc);
  return header + sections.filter((_, i) => !dropped.includes(i)).map((s) => s.text).join('');
}

/** Whether `size` describes this score's sections; a mismatch means it was measured for another. */
export const sizeFits = (abc: string, size: ScoreSize | null): size is ScoreSize =>
  !!size && size.sections.length === splitScore(abc).sections.length;

/** The planner tokens of what will be sung: the header plus the kept sections. Section counts
 * add up exactly, since the tokenizer never joins text across a line break. */
export const keptTokens = (size: ScoreSize, dropped: number[] = []): number =>
  size.header + size.sections.reduce((sum, s, i) => sum + (dropped.includes(i) ? 0 : s.tokens), 0);

/** The `n` largest kept sections, largest first: the ones worth leaving out to fit. */
export function largestKept(size: ScoreSize, dropped: number[] = [], n = 2): string[] {
  return size.sections
    .map((s, i) => ({ ...s, i }))
    .filter((s) => !dropped.includes(s.i))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, n)
    .map((s) => s.name);
}

/** `dropped` with section `i` toggled, or unchanged when that would leave nothing to sing. */
export function toggleSection(count: number, dropped: number[] = [], i: number): number[] {
  if (dropped.includes(i)) return dropped.filter((d) => d !== i);
  const next = [...dropped, i].sort((a, b) => a - b);
  return next.length >= count ? dropped : next;
}
