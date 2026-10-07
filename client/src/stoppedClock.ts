import { useEffect, useState } from 'react';
import { DIM_WINDOW_MS } from './footerMode';

/** The effect behind useMsSinceStopped: while stopped it stamps the moment playback stopped and
 * wakes once the dim window has passed; while playing it clears the stamp. Returns the cleanup. */
export function watchStop(
  isPlaying: boolean,
  onStamp: (stoppedAt: number | null) => void,
  onExpire: () => void,
  windowMs = DIM_WINDOW_MS,
): () => void {
  if (isPlaying) {
    onStamp(null);
    return () => {};
  }
  onStamp(Date.now());
  const timer = setTimeout(onExpire, windowMs);
  return () => clearTimeout(timer);
}

/** Milliseconds since the footer's song stopped playing (0 while it plays). Re-renders when the
 * dim window runs out, so the footer can slide away without any other state changing. A new
 * song restarts the clock, even if it is not playing yet. */
export function useMsSinceStopped(isPlaying: boolean, songKey: string | null): number {
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [, setWakes] = useState(0);
  useEffect(() => watchStop(isPlaying, setStoppedAt, () => setWakes((n) => n + 1)), [isPlaying, songKey]);
  return stoppedAt === null ? 0 : Date.now() - stoppedAt;
}
