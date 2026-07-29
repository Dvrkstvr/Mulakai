import type { Song } from './api';

export type GenType = 'prompt' | 'audio' | 'complete';
export type Source = 'upload' | 'library';

/** Prefill for the Create screen — built either from a plain typed prompt
 * (Library's create bar) or from an existing song (the detail rail's REUSE
 * PROMPT / CREATE COVER FROM AUDIO actions). */
export interface CreateDraft {
  genType?: GenType;
  source?: Source;
  selectedSongId?: string;
  prompt?: string;
  lyrics?: string;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  duration?: number;
  /** A short idea typed into the library's create bar, not yet expanded by the LM —
   * CreateView runs the expansion itself and plays the "AI thinking" reveal
   * (useThinkingQuery.ts / ThinkingWipe.tsx) instead of blocking the library. */
  pendingQuery?: string;
  /** Carried over from whichever folder was active in the Library when Create was opened —
   * the new song is filed there on generation, and its name informs the Title default
   * (see CreateView.tsx's next-title fetch). Absent when Create was opened from
   * All Songs/Unfiled, or the reuse/cover actions on a song with no folder. */
  folderId?: string;
  folderName?: string;
  /** Set by REUSE PROMPT on a cover/arrange-origin song: the title it was reused from.
   * Those tabs need a source track, and the original one isn't recoverable (uploads
   * aren't kept, library bounces are ephemeral), so the tab opens source-less and says
   * so inline rather than pretending the draft is ready to generate. */
  reusedFrom?: string;
}

/** The ACE-Step task a song was made with (`songs.gen_task`, or the generation lock's
 * `task`) -> the Create tab that produces it. Anything unrecognized — including the null
 * left on songs whose origin couldn't be backfilled — falls back to PROMPT, which is how
 * every song behaved before the task was recorded. */
export const taskToGenType = (task: string | null | undefined): GenType =>
  task === 'cover' ? 'audio' : task === 'complete' ? 'complete' : 'prompt';

/** Reuse a song's creative input — prompt, lyrics, and song details — on the tab that
 * originally produced it. Landing a cover's prompt in PROMPT (as this used to do) put
 * text meaning "describe the change from the source" into a from-scratch field, where it
 * reads as nonsense. */
export const reusePromptDraft = (song: Song): CreateDraft => {
  const genType = taskToGenType(song.gen_task);
  return {
    genType,
    prompt: song.caption,
    lyrics: song.lyrics,
    ...(song.bpm ? { bpm: song.bpm } : {}),
    ...(song.key_scale ? { keyScale: song.key_scale } : {}),
    ...(song.time_signature ? { timeSignature: song.time_signature } : {}),
    ...(song.duration ? { duration: song.duration } : {}),
    ...(genType === 'prompt' ? {} : { reusedFrom: song.title }),
  };
};

export const createCoverDraft = (song: Song): CreateDraft => ({
  genType: 'audio',
  source: 'library',
  selectedSongId: song.id,
});
