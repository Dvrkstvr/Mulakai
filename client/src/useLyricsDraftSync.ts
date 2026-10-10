import { useEffect } from 'react';
import type { SongDetail } from './api';
import { loadDraft, restoreDraft, saveDraft } from './lyricsDraftStore';

/** Keeps the Editor's lyrics draft in step with the song's stored lyrics, and kept in this browser per song until a
 * repaint keeps it (lyricsDraftStore, PLAN.md "Editor Redesign", PR 7). */
export function useLyricsDraftSync(song: SongDetail | null, draft: string, setLyricsDraft: (lyrics: string) => void) {
  // Re-sync only when the *canonical* text changes (new song, or a repaint/revert updated it) — not on every reload()
  // (layer mutes, added layers, etc. would otherwise wipe an in-progress edit that hasn't been repainted yet).
  useEffect(() => {
    if (!song) { setLyricsDraft(''); return; }
    setLyricsDraft(restoreDraft(loadDraft(song.id), song.lyrics ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, song?.lyrics]);

  useEffect(() => {
    if (song) saveDraft(song.id, song.lyrics ?? '', draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
}
