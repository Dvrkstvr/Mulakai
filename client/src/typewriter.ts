/** Animates `setValue` from '' to the full text over `durationMs` — used to "type" an
 * LM-generated prompt/lyrics into view as ThinkingWipe sweeps away (CreateView.tsx).
 * Returns a cancel function to stop mid-animation (e.g. on unmount or a re-trigger). */
export function typewrite(text: string, setValue: (v: string) => void, durationMs: number): () => void {
  if (!text) { setValue(''); return () => {}; }
  const start = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    setValue(text.slice(0, Math.round(text.length * t)));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
