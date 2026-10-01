import { useEffect, useMemo, useState } from 'react';
import { api, type SongDetail } from './api';
import { errorText } from './actionError';

/**
 * A reload that never rejects: success replaces the song and clears the error; a
 * failure sets the error and leaves whatever song is showing alone, so a failed
 * refresh (after a mute, a revert, a claimed stem) doesn't blank a loaded Editor.
 * Callers that await it inside their own try/catch therefore never report it twice.
 */
export function songReloader(
  load: () => Promise<SongDetail>,
  setSong: (song: SongDetail) => void,
  setLoadError: (message: string) => void,
): () => Promise<void> {
  return () => load().then(
    (song) => { setSong(song); setLoadError(''); },
    (err: unknown) => setLoadError(errorText(err)),
  );
}

/** The Editor's song, its last load error, and `reload` (see songReloader). */
export function useSongDetail(songId: string) {
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const reload = useMemo(() => songReloader(() => api.songDetail(songId), setSong, setLoadError), [songId]);
  useEffect(() => { void reload(); }, [reload]);
  return { song, loadError, reload };
}
