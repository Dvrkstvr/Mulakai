/** How the Library's docked footer player sits: fully up, half down and dimmed, or slid away. */
export type FooterMode = 'shown' | 'dimmed' | 'hidden';

/** How long the footer stays fully up after a pause or end, so the play button is still where
 * the pointer left it. */
export const PAUSE_GRACE_MS = 4_000;

/** How long a paused or ended song keeps the footer dimmed before it slides away. */
export const DIM_WINDOW_MS = 60_000;

export interface FooterInputs {
  /** A song with audio is loaded into the footer. */
  hasSong: boolean;
  isPlaying: boolean;
  /** Time since playback last stopped; ignored while playing. */
  msSinceStopped: number;
  /** A song generation is loading or running. */
  generating: boolean;
  /** The Library is the view on screen (no Editor, CHAT, Create, Settings or Forge). */
  onLibrary: boolean;
  /** The pointer is on the footer or on the bottom-edge reveal zone. */
  peeking: boolean;
}

/** The footer's state (PLAN.md "Footer Player Shows, Dims and Hides With Playback"). A peek
 * wins over a generation and over the 60 s timeout, but never shows it off the Library. */
export function footerMode(i: FooterInputs): FooterMode {
  if (!i.hasSong || !i.onLibrary) return 'hidden';
  if (i.peeking) return 'shown';
  if (i.generating) return 'hidden';
  if (i.isPlaying || i.msSinceStopped < PAUSE_GRACE_MS) return 'shown';
  return i.msSinceStopped < DIM_WINDOW_MS ? 'dimmed' : 'hidden';
}
