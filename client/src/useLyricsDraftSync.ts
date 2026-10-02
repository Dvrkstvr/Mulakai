import { useEffect } from 'react';
import type { SongDetail } from './api';

/** Keeps the Editor's lyrics draft in step with the song's stored lyrics. */
export function useLyricsDraftSync(song: SongDetail | null, setLyricsDraft: (lyrics: string) => void) {
  // Re-sync the editable lyrics draft only when the *canonical* text actually
  // changes (new song, or this song's lyrics were updated by a repaint/revert)
  // — not on every reload() (layer mutes, added layers, etc. would otherwise
  // wipe an in-progress edit that hasn't been repainted yet).
  useEffect(() => {
    setLyricsDraft(song?.lyrics ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, song?.lyrics]);
}
