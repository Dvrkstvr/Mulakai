/** The chat strip's section clicks: a click marks the section, a double-click moves the playhead to its start. The
 * mark waits out the double-click window: marking shows the chip row, which lifts the strip, so a second click would
 * land on the waveform under it. Pure. */
import type { ShownBars, StripSection } from './api/chatAnalysis';

/** How long a click waits for a second one before it marks. */
export const DOUBLE_CLICK_MS = 250;

/** Where section `s` starts in seconds: its own time, else its first bar's; null when neither is read. */
export function sectionStart(s: StripSection, bars: ShownBars | null): number | null {
  if (s.seconds) return s.seconds[0];
  return bars?.starts[s.bars[0] - 1] ?? null;
}

/** One strip's click handling. `click(detail, run)`: a keyboard press (detail 0) runs at once; a first click runs after
 * the window; a later click of a burst runs nothing. `double(run)` cancels the pending click and runs. */
export function sectionClicks(ms = DOUBLE_CLICK_MS) {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(pending); pending = undefined; };
  return {
    click(detail: number, run: () => void) {
      cancel();
      if (detail === 0) run();
      else if (detail === 1) pending = setTimeout(() => { pending = undefined; run(); }, ms);
    },
    double(run: () => void) { cancel(); run(); },
    cancel,
  };
}
