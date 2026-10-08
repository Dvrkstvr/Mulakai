/**
 * The reading line's LINES (F-053, C1 live B4): derived from the strip's own pairing, so the line and the strip
 * agree. YuE2's own score: the sum of the shown sections' paired blocks (the k-th section of a kind sings the k-th
 * block of it, D-066 d); blocks that pair with no shown section are `outside`. A transcribed score with word timings:
 * the segments touching any shown section, a line crossing an edge counted once; segments touching none are
 * `outside`. With no score, or word timings but no bar times (no pairing), the words read (`fallback`). Pure.
 */
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';
import type { StripSection } from './analysisTypes.js';

export interface ReadingLines { lines: number; outside: number }

/** `words`: the timings the strip counted from (null when it paired blocks); `timed`: the strip has bar times. */
export function readingLines(
  facts: ScoreFacts | null, sections: StripSection[], words: LyricsReading | null, timed: boolean, fallback: number,
): ReadingLines {
  if (!facts) return { lines: fallback, outside: 0 };
  if (words) {
    if (!timed) return { lines: fallback, outside: 0 };
    const spans = sections.flatMap((s) => (s.seconds ? [s.seconds] : []));
    const inside = words.segments.filter((w) => spans.some(([a, b]) => w.start < b && w.end > a)).length;
    return { lines: inside, outside: words.segments.length - inside };
  }
  const lines = sections.reduce((n, s) => n + s.lines, 0);
  const all = facts.lyric_blocks.reduce((n, b) => n + b.lines, 0);
  return { lines, outside: Math.max(0, all - lines) };
}
