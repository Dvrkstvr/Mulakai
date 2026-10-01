import type { LyricLine } from './api';
import type { LyricAlignment } from './lyricAlign';

/** Below this share of LYRICS words heard, ACE-Step's own timings (if any) keep the strip. */
export const MIN_MATCHED = 0.5;
/** How far before its first sung word a section starts when a wordless run precedes it. */
export const LEAD_IN_SECONDS = 1;

const TAG_RE = /^\s*\[[^\]]+\]\s*$/;

/**
 * Turns aligned LYRICS lines into the `LyricLine[]` that `groupSections` reads: every tag
 * line with a start, plus the timed lines in order (PLAN.md "Editor Word Timestamps",
 * decision 4). A sung section starts where the previous sung line ended, as ACE-Step's tag
 * lines do. A run of wordless tags starts there too and leaves the next sung section to
 * start a lead-in before its first word. Only the run's first tag gets that gap: the rest
 * sit at its end with no width, and `groupSections` drops them from the strip.
 */
export function alignedLyricLines(lyrics: string, alignment: LyricAlignment, duration: number): LyricLine[] {
  const texts = lyrics.split('\n');
  const isTag = texts.map((t) => TAG_RE.test(t));
  // The first timed line in each tag's section (up to the next tag), or null when wordless.
  const firstSung = texts.map((_, i) => {
    if (!isTag[i]) return null;
    for (let j = i + 1; j < texts.length && !isTag[j]; j++) if (alignment.lines[j]) return alignment.lines[j];
    return null;
  });

  const out: LyricLine[] = [];
  let prevEnd = 0;
  let inRun = false;
  let runRest: LyricLine[] = []; // wordless tags after a run's first, placed once the run's end is known
  const endRun = (at: number) => {
    for (const line of runRest) { line.start = at; line.end = at; }
    runRest = [];
    inRun = false;
  };
  texts.forEach((text, i) => {
    const span = alignment.lines[i];
    if (!isTag[i]) {
      if (span) {
        out.push({ text, start: span.start, end: span.end });
        prevEnd = span.end;
      }
      return;
    }
    const first = firstSung[i];
    if (!first) {
      const line = { text, start: prevEnd, end: prevEnd };
      if (inRun) runRest.push(line);
      inRun = true;
      out.push(line);
      return;
    }
    const start = inRun ? Math.max(prevEnd, first.start - LEAD_IN_SECONDS) : prevEnd;
    endRun(start);
    out.push({ text, start, end: start });
  });
  endRun(Math.max(prevEnd, duration));
  return out;
}

/**
 * Which timings build the section strip (decision 5): the reading when it heard at least
 * half the LYRICS words, else ACE-Step's stored ones, else whatever the reading gave.
 */
export function sectionTimings(
  aceLines: LyricLine[] | null | undefined,
  lyrics: string,
  alignment: LyricAlignment | null,
  duration: number,
): LyricLine[] | null {
  if (alignment && alignment.matched >= MIN_MATCHED) return alignedLyricLines(lyrics, alignment, duration);
  if (aceLines?.length) return aceLines;
  return alignment ? alignedLyricLines(lyrics, alignment, duration) : null;
}
