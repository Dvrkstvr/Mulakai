import { useEffect, useRef } from 'react';
import type { Song } from './api';
import { useGenerationStore, type GenerationJob } from './generationStore';
import { useModelStatusStore } from './modelStatusStore';
import type { LibraryData } from './useLibraryData';

interface Options {
  library: LibraryData;
  genJobs: GenerationJob[];
  hydrateGenJob: () => Promise<void>;
  setPlaying: (song: Song) => void;
}

/** The app shell's server sync: the initial library load, ACE-Step health and generation-lock
 * polling, folder-scope persistence, and the library refresh once a generation lands. */
export function useAppSync({ library, genJobs, hydrateGenJob, setPlaying }: Options) {
  const { folderScope, setFolderScope, folders, refresh, refreshFolders } = library;

  useEffect(() => {
    refresh();
    refreshFolders();
    hydrateGenJob();
    const checkHealth = () => void useModelStatusStore.getState().checkAcestep();
    checkHealth();
    const timer = setInterval(checkHealth, 10_000);
    // Keeps generationStore's otherLock live (the Editor's automatic word-timings read waits for
    // an idle GPU), and gives a generation started in another tab its own Library card.
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

  // Each generating card's store drops it a moment after it flips to 'done' (see
  // generationPoll.ts's DONE_LINGER_MS) — refresh the library right as one does so the real
  // song row is already in `songs` by the time the placeholder unmounts, then load the
  // freshly generated song into the footer player so it's ready to hit play immediately.
  const landed = genJobs.filter((j) => j.stage === 'done' && j.songId).map((j) => j.songId as string);
  const seen = useRef(new Set<string>());
  const landedKey = landed.join(',');
  useEffect(() => {
    const fresh = landed.filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    const newSongId = fresh[fresh.length - 1];
    refreshFolders();
    void refresh().then((list) => {
      const newSong = list?.find((s) => s.id === newSongId);
      if (newSong) setPlaying(newSong);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedKey]);
}
