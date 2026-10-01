/** Whether TRANSCRIBE starts READ LYRICS by itself once its score lands (PLAN.md "READ LYRICS
 * With TRANSCRIBE for Uploads"). Pure. */
import type { Source } from './createDraft';

export interface AutoReadFacts {
  source: Source;
  /** transcribeStore.start's answer: the score landed over LYRICS with none of the user's words. */
  lyricsOpen: boolean;
  /** lyrics-server is configured and answering. */
  readerReady: boolean;
  /** The picked source, and the one READ LYRICS' stored reading came from. */
  sourceKey: string | null;
  readSourceKey: string | null;
}

export function shouldAutoRead(f: AutoReadFacts): boolean {
  // A library song brings its own words; a source already read re-places that reading instead.
  return f.source === 'upload' && f.lyricsOpen && f.readerReady && f.sourceKey !== null && f.readSourceKey !== f.sourceKey;
}
