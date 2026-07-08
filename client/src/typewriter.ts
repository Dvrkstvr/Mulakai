/** Animates `setValue` from '' to the full text over `durationMs` — used to "type" an
 * LM-generated prompt/lyrics into view as ThinkingWipe sweeps away (CreateView.tsx).
 * Returns a cancel function to stop mid-animation (e.g. on unmount or a re-trigger). */
export function typewrite(text: string, setValue: (v: string) => void, durationMs: number): () => void {
  if (!text) { setValue(''); return () => {}; }
  const start = performance.now();
  let raf = 0;
  let done = false;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    setValue(text.slice(0, Math.round(text.length * t)));
    if (t < 1) raf = requestAnimationFrame(step);
    else done = true;
  };
  raf = requestAnimationFrame(step);
  // If cancelled before finishing (e.g. ThinkingWipe's CSS-transition sweep completes
  // a frame ahead of this rAF loop and flips thinkPhase, unmounting this call), snap to
  // the full text instead of freezing mid-word — the two animations are independently
  // clocked and cannot be guaranteed to finish on the exact same frame.
  return () => { cancelAnimationFrame(raf); if (!done) setValue(text); };
}
