/** AN IDEA's INSTRUMENTAL toggle: ACE-Step's documented lyric for a song with no vocals
 * (docs/ace-step-1.5/GUIDE.md, "Writing Instrumental Music"). */
export const INSTRUMENTAL_LYRICS = '[Instrumental]';

export const isInstrumental = (lyrics: string): boolean => lyrics.trim().toLowerCase() === INSTRUMENTAL_LYRICS.toLowerCase();

/** What LYRICS become when INSTRUMENTAL is pressed, or null when it can't be: words the user
 * typed are never replaced by a toggle, so it waits for an empty box. */
export function toggleInstrumental(lyrics: string): string | null {
  if (isInstrumental(lyrics)) return '';
  return lyrics.trim() ? null : INSTRUMENTAL_LYRICS;
}
