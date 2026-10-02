/** Repaint region range per docs/ace-step-1.5/GUIDE.md#3 (3s min, 90s max). */
export const REPAINT_MIN_SECONDS = 3;
export const REPAINT_MAX_SECONDS = 90;

/** Crossfade ceiling, seconds, before halving (see maxCrossfadeSec). */
const CROSSFADE_CAP_SECONDS = 5;

/** The longest crossfade a region takes: half of whichever is smaller, the ceiling or the
 * region itself (a splice fade can't outlast half the span it blends into), rounded down
 * to the input's 0.1 s step so the box never shows a dragged region's raw float. 0 for a
 * region outside the repaint range, which can't be submitted anyway. */
export function maxCrossfadeSec(regionSeconds: number): number {
  const valid = regionSeconds >= REPAINT_MIN_SECONDS && regionSeconds <= REPAINT_MAX_SECONDS;
  return valid ? Math.floor((Math.min(CROSSFADE_CAP_SECONDS, regionSeconds) / 2) * 10) / 10 : 0;
}

/** The crossfade a repaint of this region actually sends. The stored setting may hold a
 * value saved for a longer region, so it is clamped here at use, not only when edited. */
export function clampCrossfade(sec: number, regionSeconds: number): number {
  return Math.min(maxCrossfadeSec(regionSeconds), Math.max(0, Number.isFinite(sec) ? sec : 0));
}
