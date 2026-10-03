/** AN IDEA's INSTRUMENTAL toggle: ACE-Step's documented lyric for a song with no vocals
 * (docs/ace-step-1.5/GUIDE.md, "Writing Instrumental Music"). */
export const INSTRUMENTAL_LYRICS = '[Instrumental]';

export const isInstrumental = (lyrics: string): boolean => lyrics.trim().toLowerCase() === INSTRUMENTAL_LYRICS.toLowerCase();

/** The reason line under LYRICS when the selected engine has no instrumental mode (INSTRUMENTAL
 * stays in place, disabled — descriptor-driven N/A), warning too if the tag would be sung. */
export function instrumentalNaNote(engineLabel: string, lyrics: string): string {
  return `INSTRUMENTAL — ${engineLabel} has no instrumental mode`
    + (isInstrumental(lyrics) ? ` · it would sing ${INSTRUMENTAL_LYRICS} as a word, so write lyrics or switch engine` : '');
}

/** What LYRICS become when INSTRUMENTAL is pressed, or null when it can't be: words the user
 * typed are never replaced by a toggle, so it waits for an empty box. */
export function toggleInstrumental(lyrics: string): string | null {
  if (isInstrumental(lyrics)) return '';
  return lyrics.trim() ? null : INSTRUMENTAL_LYRICS;
}
