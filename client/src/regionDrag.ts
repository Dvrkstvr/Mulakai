import type { Region } from './Waveform';

export type DragMode = 'create' | 'move' | 'resize-start' | 'resize-end';

/** Classify where a click lands relative to the existing selection, in seconds-space. */
export function hitTestRegion(seconds: number, region: Region | null, edgeToleranceSeconds: number): DragMode {
  if (!region) return 'create';
  if (Math.abs(seconds - region.start) <= edgeToleranceSeconds) return 'resize-start';
  if (Math.abs(seconds - region.end) <= edgeToleranceSeconds) return 'resize-end';
  if (seconds > region.start && seconds < region.end) return 'move';
  return 'create';
}

/**
 * Compute the next region for a drag mode. `origin` is the region as it was
 * at drag-start (not the live-updating selection) so repeated moves don't
 * compound drift.
 */
export function applyDrag(
  mode: DragMode,
  origin: Region | null,
  dragStartSeconds: number,
  currentSeconds: number,
  duration: number,
  minSeconds: number,
  maxSeconds: number,
): Region | null {
  const clamp = (v: number) => Math.max(0, Math.min(duration, v));

  if (mode === 'create') {
    return { start: clamp(Math.min(dragStartSeconds, currentSeconds)), end: clamp(Math.max(dragStartSeconds, currentSeconds)) };
  }
  if (!origin) return origin;

  if (mode === 'move') {
    const width = origin.end - origin.start;
    let start = origin.start + (currentSeconds - dragStartSeconds);
    let end = start + width;
    if (start < 0) { start = 0; end = width; }
    if (end > duration) { end = duration; start = duration - width; }
    return { start, end };
  }
  if (mode === 'resize-start') {
    const minStart = Math.max(0, origin.end - maxSeconds);
    const maxStart = origin.end - minSeconds;
    return { start: Math.min(Math.max(clamp(currentSeconds), minStart), maxStart), end: origin.end };
  }
  // resize-end
  const minEnd = origin.start + minSeconds;
  const maxEnd = Math.min(duration, origin.start + maxSeconds);
  return { start: origin.start, end: Math.min(Math.max(clamp(currentSeconds), minEnd), maxEnd) };
}
