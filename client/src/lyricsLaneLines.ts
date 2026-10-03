import type { LineSpan } from './lyricAlign';

export interface LaneLine extends LineSpan {
  /** The line's index in the draft (split on '\n'), as `alignLyrics` and `lineRegion` count it. */
  index: number;
  text: string;
}

const TAG_RE = /^\s*\[[^\]]+\]\s*$/;

/**
 * The LYRICS lane's chips: each heard line of the draft at its sung span. Tag and blank lines
 * have no words to hear, so they're left out silently; a sung line that wasn't heard has no
 * time to sit at, so it's left out and counted (the lane's "· 3 lines not heard").
 */
export function laneLines(draft: string, spans: (LineSpan | null)[]): { lines: LaneLine[]; unheard: number } {
  const lines: LaneLine[] = [];
  let unheard = 0;
  draft.split('\n').forEach((text, index) => {
    if (!text.trim() || TAG_RE.test(text)) return;
    const span = spans[index];
    if (span) lines.push({ index, text: text.trim(), start: span.start, end: span.end });
    else unheard++;
  });
  return { lines, unheard };
}
