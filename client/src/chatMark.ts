/** The mark's geometry (F-054, F-055; CS-5, CS-11): a section click, an edge drag, a body move, a new drag on the
 * waveform; edges snap to bar lines (Alt frees them), the mark stays inside the song; with no usable bars (a hatched
 * strip) it is seconds only and snaps once a reading lands. `markStale` says whether a mark still fits the playable
 * version: valid, carried (its edit moved no bars; across a tempo change only once its bars are read) or stale (with
 * USE BARS only when the edit reported the shift, or kept the bars at a new tempo).
 * Never remaps silently. Pure. Bars are 1-based and inclusive. `duration`: the playing audio's length (the view has
 * none); without it the reading's end bounds the mark. */
import type { AnalysisView, RangeMark, Shift, ShownBars, StripSection } from './api/chatAnalysis';

/** A drag shorter than this is a click, not a mark. */
export const MIN_MARK_SECONDS = 0.25;

/** The bars the strip may snap to: only a reading of the playable version, or a dimmed one whose edit moved no bars. */
export function usableBars(view: AnalysisView | null): ShownBars | null {
  const r = view?.shown;
  if (!r || r.mode === 'hatched' || !r.bars || r.bars.starts.length === 0) return null;
  return r.bars;
}

/** Every bar line: each bar's start, then the end of the last bar. */
const lines = (b: ShownBars) => [...b.starts, b.end];
/** Bar `n`'s start; bar count + 1 = the end line. */
const lineAt = (b: ShownBars, n: number) => lines(b)[Math.min(Math.max(n - 1, 0), b.starts.length)];

/** The bar holding time `t` (the last one whose start is ≤ t), clamped to the bars. */
export function barAt(b: ShownBars, t: number): number {
  let i = 0;
  while (i + 1 < b.starts.length && b.starts[i + 1] <= t) i++;
  return i + 1;
}

/** The nearest bar line to `t` (`line` = the bar it starts, or count + 1 for the end), unless `free` or no bars. */
export function snapTime(t: number, bars: ShownBars | null, free = false): { t: number; line: number | null } {
  if (!bars || free) return { t, line: null };
  const all = lines(bars);
  let best = 0;
  for (let i = 1; i < all.length; i++) if (Math.abs(all[i] - t) < Math.abs(all[best] - t)) best = i;
  return { t: all[best], line: best + 1 };
}

/** The bars a sung span is in (R-041; the server's `markSnap` rule, D-195): every bar it covers at least half of,
 * else the bar holding its middle. One source for a line's chip and the bar number beside it. */
export function lineBars(b: ShownBars, [s, e]: [number, number]): [number, number] {
  const all = lines(b);
  const held: number[] = [];
  for (let i = 0; i + 1 < all.length; i++) {
    const len = all[i + 1] - all[i];
    if (len > 0 && Math.min(e, all[i + 1]) - Math.max(s, all[i]) >= len / 2) held.push(i + 1);
  }
  if (held.length) return [held[0], held[held.length - 1]];
  const mid = barAt(b, (s + e) / 2);
  return [mid, mid];
}

/** Keep `[a, b]` inside the song (`length` null: only above 0). */
export function clampSeconds(a: number, b: number, length: number | null): [number, number] {
  const hi = length ?? Infinity;
  const lo = Math.max(0, Math.min(a, b));
  return [Math.min(lo, hi), Math.min(Math.max(a, b), hi)];
}

const songLength = (view: AnalysisView | null, duration?: number | null) => duration ?? view?.shown?.bars?.end ?? null;

/** The reading a bars mark is counted on (RT-5): only the playable version's own; a dimmed older one is not stamped. */
const counted = (view: AnalysisView): { readAt?: string } =>
  (view.shown && view.shown.versionId === view.versionId ? { readAt: view.shown.readAt } : {});

/** A mark over seconds `[a, b]` of the playable version: snapped to bar lines and carrying the bars it covers when the
 * strip has bars; free (Alt) keeps the exact seconds and carries the bars it touches. Null: too short, or no version. */
export function markSeconds(view: AnalysisView | null, a: number, b: number, free = false, duration?: number | null): RangeMark | null {
  if (!view?.versionId) return null;
  const bars = usableBars(view);
  let [s, e] = clampSeconds(a, b, songLength(view, duration));
  if (e - s < MIN_MARK_SECONDS) return null;
  if (!bars) return { kind: 'range', versionId: view.versionId, seconds: [s, e] };
  if (!free) {
    const from = snapTime(s, bars).line!;
    const to = snapTime(e, bars).line! - 1;
    // Both edges snapped to one line: a short drag marks the bar holding its middle (R-041: not the one it starts in).
    if (to < from) return markBars(view, barAt(bars, (s + e) / 2), barAt(bars, (s + e) / 2));
    return markBars(view, from, to);
  }
  [s, e] = [Math.max(s, bars.starts[0]), Math.min(e, bars.end)];
  if (e - s < MIN_MARK_SECONDS) return null;
  return { kind: 'range', versionId: view.versionId, bars: [barAt(bars, s), barAt(bars, Math.max(s, e - 1e-6))], seconds: [s, e], ...counted(view) };
}

/** A mark over whole bars `from..to` of the playable version's reading. */
export function markBars(view: AnalysisView, from: number, to: number): RangeMark | null {
  const bars = usableBars(view);
  if (!view.versionId || !bars) return null;
  const n = bars.starts.length;
  const [f, t] = [Math.max(1, Math.min(from, to, n)), Math.min(n, Math.max(from, to, 1))];
  return { kind: 'range', versionId: view.versionId, bars: [f, t], seconds: [lineAt(bars, f), lineAt(bars, t + 1)], ...counted(view) };
}

/** Click a strip section: it is the mark. */
export const markSection = (view: AnalysisView, s: StripSection): RangeMark | null => markBars(view, s.bars[0], s.bars[1]);

/** Drag one edge to time `t`; the other edge stays. Crossing it swaps the edges. */
export function dragEdge(
  view: AnalysisView, mark: RangeMark, edge: 'start' | 'end', t: number, free = false, duration?: number | null,
): RangeMark | null {
  const [a, b] = mark.seconds;
  return edge === 'start' ? markSeconds(view, t, b, free, duration) : markSeconds(view, a, t, free, duration);
}

/** Drag the body by `dt` seconds: same length, stopped at the song's ends; snapped, it moves by whole bars. */
export function moveBody(view: AnalysisView, mark: RangeMark, dt: number, free = false, duration?: number | null): RangeMark | null {
  const bars = usableBars(view);
  if (bars && !free && mark.bars) {
    const n = bars.starts.length;
    const span = mark.bars[1] - mark.bars[0];
    const to = snapTime(mark.seconds[0] + dt, bars).line!;
    const from = Math.max(1, Math.min(to, n - span));
    return markBars(view, from, from + span);
  }
  const [a, b] = mark.seconds;
  const len = songLength(view, duration) ?? Infinity;
  const d = Math.max(-a, Math.min(dt, len - b));
  return markSeconds(view, a + d, b + d, true, duration);
}

/** A seconds-only mark on the playable version, snapped to bars once its reading lands; anything else unchanged. */
export function landBars(view: AnalysisView, mark: RangeMark): RangeMark {
  if (mark.bars || mark.versionId !== view.versionId || !usableBars(view)) return mark;
  return markSeconds(view, mark.seconds[0], mark.seconds[1]) ?? mark;
}

/** A bar of the base mapped through the edit's shift: bars from `atBar` on move by `delta`; a bar a CUT removed is
 * gone (null). */
export function shiftBar(b: number, s: Shift): number | null {
  if (b < s.atBar) return b;
  const to = b + s.delta;
  return to >= s.atBar && to >= 1 ? to : null;
}

/** The mark's bars on the new version, when the shift says so: both ends on one side of the change. */
export function shiftedBars(bars: [number, number], s: Shift): [number, number] | null {
  const [a, b] = [shiftBar(bars[0], s), shiftBar(bars[1], s)];
  if (a === null || b === null || (bars[0] < s.atBar) !== (bars[1] < s.atBar)) return null;
  return [a, b];
}

export type MarkFit =
  | { kind: 'valid' }
  /** The playable version's edit moved no bars: the same bars on it, seconds re-timed from its reading when it has one. */
  | { kind: 'carried'; mark: RangeMark }
  /** USE BARS only when the edit reported the shift and the mark maps through it. `tempo`: the edit changed the tempo
   * and kept the bars (USE BARS = the same bars, once the new version's bars are read). */
  | { kind: 'stale'; useBars: [number, number] | null; tempo?: true; reading?: true };

/** A bars mark counted on another reading of the same version: the reading was re-timed (or undone) since (RT-5). */
const recounted = (mark: RangeMark, view: AnalysisView) =>
  !!(mark.bars && mark.readAt && mark.versionId === view.versionId && view.shown?.versionId === view.versionId && view.shown.readAt !== mark.readAt);

/** Does the mark still fit what plays? (CS-11, D-175) `reading`: the same version's reading was re-timed, so every bar
 * number changed (RT-5, RT-7): stale even where the bars would fit by chance; mark again. */
export function markStale(mark: RangeMark, view: AnalysisView | null): MarkFit {
  if (view?.versionId && recounted(mark, view)) return { kind: 'stale', useBars: null, reading: true };
  if (!view?.versionId || mark.versionId === view.versionId) return { kind: 'valid' };
  const lin = view.lineage;
  if (!lin || lin.fromVersionId !== mark.versionId) return { kind: 'stale', useBars: null };
  if (!lin.moved) {
    const { readAt: _was, ...kept } = mark; // counted on the old version's reading: not this one's
    const moved: RangeMark = { ...kept, versionId: view.versionId };
    const retimed = mark.bars && view.shown?.versionId === view.versionId ? markBars(view, mark.bars[0], mark.bars[1]) : null;
    // A tempo change: the old seconds are other music, so carry only bars re-timed from the new version's own reading.
    if (lin.retimed && !retimed) return { kind: 'stale', useBars: mark.bars ?? null, tempo: true };
    return { kind: 'carried', mark: retimed ?? moved };
  }
  return { kind: 'stale', useBars: mark.bars && lin.shift ? shiftedBars(mark.bars, lin.shift) : null };
}
