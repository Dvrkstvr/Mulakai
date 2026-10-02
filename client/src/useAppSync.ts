import { useEffect } from 'react';
import { api, type Song } from './api';
import { useGenerationStore, type GenerationJob } from './generationStore';
import type { LibraryData } from './useLibraryData';

interface Options {
  library: LibraryData;
  genJob: GenerationJob | null;
  hydrateGenJob: () => Promise<void>;
  setOnline: (online: boolean) => void;
  setPlaying: (song: Song) => void;
}

/** The app shell's server sync: the initial library load, ACE-Step health and generation-lock
 * polling, folder-scope persistence, and the library refresh once a generation lands. */
export function useAppSync({ library, genJob, hydrateGenJob, setOnline, setPlaying }: Options) {
  const { folderScope, setFolderScope, folders, refresh, refreshFolders } = library;

  useEffect(() => {
    refresh();
    refreshFolders();
    hydrateGenJob();
    const checkHealth = () =>
      api.acestepHealth().then((h) => setOnline(h.acestep)).catch(() => setOnline(false));
    checkHealth();
    const timer = setInterval(checkHealth, 10_000);
    // Keeps generationStore's otherLock live so the editor's repaint/remaster/split/add-layer
    // triggers can proactively disable themselves while a generation is running anywhere,
    // not just fail with a 409 after the fact.
    const lockTimer = setInterval(() => useGenerationStore.getState().refreshLock(), 3000);
    return () => { clearInterval(timer); clearInterval(lockTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the song list whenever the folder scope changes — sort/filter stay local
  // (client-side, see visibleSongs in useLibraryData) but folder scoping is a server-side query param.
  useEffect(() => {
    void refresh();
    if (folderScope) localStorage.setItem('folderScope', folderScope);
    else localStorage.removeItem('folderScope');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderScope]);

  // A folder id restored from localStorage may no longer exist (deleted elsewhere) —
  // once folders load, fall back to "All Songs" rather than silently showing nothing.
  useEffect(() => {
    if (folderScope && folderScope !== 'unfiled' && folders.length > 0 && !folders.some((f) => f.id === folderScope)) {
      setFolderScope(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  // The generating card's own store clears `job` a moment after it flips to 'done' (see
  // generationStore.ts's DONE_LINGER_MS) — refresh the library right as that happens so
  // the real song row is already in `songs` by the time the placeholder unmounts, then load
  // the freshly generated song into the footer player so it's ready to hit play immediately.
  useEffect(() => {
    if (genJob?.stage !== 'done' || !genJob.songId) return;
    const newSongId = genJob.songId;
    refreshFolders();
    void refresh().then((list) => {
      const newSong = list?.find((s) => s.id === newSongId);
      if (newSong) setPlaying(newSong);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genJob?.stage]);
}
