import type { Region } from './Waveform';
import type { LineSpan } from './lyricAlign';
import { REPAINT_MIN_SECONDS } from './repaintLimits';

/** Same tolerance as `findActiveSectionIndex`: a selection still "is" the lines it came from. */
const SAME_EPSILON = 0.05;

const round2 = (s: number) => Math.round(s * 100) / 100;

/**
 * The region for lyric lines `from` through `to` (either order, inclusive): first sung word
 * to last, over the lines that were heard. Null when none of them were. Widened to the
 * repaint minimum (PLAN.md "Editor Word Timestamps", decision 8).
 */
export function lineRegion(spans: (LineSpan | null)[], from: number, to: number, duration: number): Region | null {
  let start = Infinity;
  let end = -Infinity;
  for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
    const span = spans[i];
    if (!span) continue;
    start = Math.min(start, span.start);
    end = Math.max(end, span.end);
  }
  return Number.isFinite(start) ? widenToMinimum({ start, end }, duration) : null;
}

/** Grows a region evenly around its middle to `min` seconds, kept inside 0…duration
 * (a duration of 0 = unknown, no upper bound). Longer regions come back as they are. */
export function widenToMinimum(region: Region, duration: number, min = REPAINT_MIN_SECONDS): Region {
  const length = region.end - region.start;
  if (length >= min) return region;
  const limit = duration > 0 ? duration : Infinity;
  const want = Math.min(min, limit);
  let start = Math.max(0, region.start - (want - length) / 2);
  let end = start + want;
  if (end > limit) { end = limit; start = Math.max(0, limit - want); }
  return { start: round2(start), end: round2(end) };
}

export function sameRegion(a: Region | null, b: Region | null): boolean {
  return !!a && !!b && Math.abs(a.start - b.start) < SAME_EPSILON && Math.abs(a.end - b.end) < SAME_EPSILON;
}
