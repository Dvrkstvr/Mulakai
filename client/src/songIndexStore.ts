import { create } from 'zustand';
import { api, type Song } from './api';

/** Every non-trashed song, regardless of the Library's folder scope or search: the palette's
 * OPEN/CREATE items and Activity's row titles read it. Reloaded on demand (palette or drawer
 * opening, a job settling), never polled. */
interface SongIndexState {
  songs: Song[];
  load: () => Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useSongIndexStore = create<SongIndexState>((set) => ({
  songs: [],
  load: () => {
    inflight ??= api.listSongs()
      .then((songs) => set({ songs }))
      .catch(() => {}) // keep the last list: a hiccup shouldn't empty the palette
      .finally(() => { inflight = null; });
    return inflight;
  },
}));

export const songTitle = (songs: Song[], songId: string | undefined): string | undefined =>
  songId ? songs.find((s) => s.id === songId)?.title : undefined;
