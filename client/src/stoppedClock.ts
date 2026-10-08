import { useEffect, useState } from 'react';
import { DIM_WINDOW_MS, PAUSE_GRACE_MS } from './footerMode';

/** The effect behind useMsSinceStopped: while stopped it stamps the moment playback stopped and
 * wakes at each mark (the pause grace ending, then the dim window); while playing it clears the
 * stamp. Returns the cleanup. */
export function watchStop(
  isPlaying: boolean,
  onStamp: (stoppedAt: number | null) => void,
  onMark: () => void,
  marks: number[] = [PAUSE_GRACE_MS, DIM_WINDOW_MS],
): () => void {
  if (isPlaying) {
    onStamp(null);
    return () => {};
  }
  onStamp(Date.now());
  const timers = marks.map((ms) => setTimeout(onMark, ms));
  return () => timers.forEach(clearTimeout);
}

/** Milliseconds since the footer's song stopped playing (0 while it plays). Re-renders when the
 * pause grace and the dim window run out, so the footer can slide away without any other state changing. A new
 * song restarts the clock, even if it is not playing yet. */
export function useMsSinceStopped(isPlaying: boolean, songKey: string | null): number {
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [, setWakes] = useState(0);
  useEffect(() => watchStop(isPlaying, setStoppedAt, () => setWakes((n) => n + 1)), [isPlaying, songKey]);
  return stoppedAt === null ? 0 : Date.now() - stoppedAt;
}
