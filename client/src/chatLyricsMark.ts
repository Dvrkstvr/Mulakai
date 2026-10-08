/** Marking from the lyrics panel (F-056 #2, LY-5, D-218): a line's time (a YuE2 line aligned by the Editor's
 * `alignLyrics` over the version's word timings, or a heard line's own seconds), and the gestures, each a C1
 * `RangeMark` through `chatMark`'s snap and clamp: click a line, shift-click extends, a header marks its section,
 * double-click plays from the line (or the section start). A line with no time marks its section. Pure. */
import type { AnalysisView, RangeMark } from './api/chatAnalysis';
import type { LyricsPanel, PanelLine, PanelSection } from './api/chatConverge';
import type { WordTimings } from './api/lyrics';
import { lineBars, markBars, markSeconds, usableBars } from './chatMark';
import { alignLyrics, type LineSpan } from './lyricAlign';

/** Per line of `LyricsPanel.text` (split on '\n'): its sung span, or null. */
export type LineTimes = ReadonlyArray<LineSpan | null>;

/** The YuE2 lines' times: null for heard lines (they carry their own), no stored text, or no word timings. The caller
 * memoizes it per version: the alignment is quadratic in words. */
export function lineTimes(panel: LyricsPanel | null, timings: WordTimings | null): LineTimes | null {
  if (!panel || panel.source !== 'blocks' || !panel.text || !timings?.segments.length) return null;
  return alignLyrics(panel.text, timings).lines;
}

/** A line's seconds on the version's timeline, or null when it has no time. */
export function lineSeconds(line: PanelLine, times: LineTimes | null): [number, number] | null {
  const at = line.at;
  if (!at) return null;
  if ('seconds' in at) return at.seconds;
  const span = times?.[at.textLine];
  return span ? [span.start, span.end] : null;
}

/** A header click: the section's bars, or its seconds when the strip has no usable bars (a hatched reading). */
export function sectionMark(view: AnalysisView, s: PanelSection, duration?: number | null): RangeMark | null {
  return markBars(view, s.bars[0], s.bars[1]) ?? (s.seconds ? markSeconds(view, s.seconds[0], s.seconds[1], false, duration) : null);
}

/** A line click: the bars it is sung in (`lineBars`, R-041); on a strip without bars its seconds; untimed or shorter
 * than a click there, its section. */
export function lineMark(view: AnalysisView, s: PanelSection, line: PanelLine, times: LineTimes | null, duration?: number | null): RangeMark | null {
  const sec = lineSeconds(line, times);
  if (!sec) return sectionMark(view, s, duration);
  const bars = usableBars(view);
  if (bars) return markBars(view, ...lineBars(bars, sec));
  return markSeconds(view, sec[0], sec[1], false, duration) ?? sectionMark(view, s, duration);
}

/** Shift-click: the mark stretched to cover `target` too; with no mark (or one on another version) it is `target`. */
export function extendMark(view: AnalysisView, current: RangeMark | null, target: RangeMark | null, duration?: number | null): RangeMark | null {
  if (!target) return current;
  if (!current || current.versionId !== target.versionId) return target;
  if (current.bars && target.bars) {
    return markBars(view, Math.min(current.bars[0], target.bars[0]), Math.max(current.bars[1], target.bars[1])) ?? target;
  }
  const [a, b] = [Math.min(current.seconds[0], target.seconds[0]), Math.max(current.seconds[1], target.seconds[1])];
  return markSeconds(view, a, b, false, duration) ?? target;
}

/** Double-click: where playback starts (the line, else its section), null when neither has a time. */
export function playFrom(s: PanelSection, line: PanelLine | null, times: LineTimes | null): number | null {
  return (line ? lineSeconds(line, times)?.[0] : undefined) ?? s.seconds?.[0] ?? null;
}
