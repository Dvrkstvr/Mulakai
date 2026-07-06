import { useEffect, useState } from 'react';

/** Shared "0:34"-style elapsed-time formatting for every in-progress generation
 * indicator (library GeneratingCard, and the editor's repaint/remaster/split/add-layer). */
export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Ticks once a second while `active`, so a component can render a live "N:NN elapsed"
 * readout without each call site re-implementing its own interval. Returns 0 when inactive
 * or `startedAt` is unset. */
export function useElapsedMs(active: boolean, startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return active && startedAt ? now - startedAt : 0;
}
