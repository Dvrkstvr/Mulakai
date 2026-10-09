import { create } from 'zustand';

/** Per-invocation Add Layer lyrics, written by the dock's lyrics field
 * (DockAddLayerFields) and read when ADD LAYER commits (DockAddLayer). Lyrics live
 * here — not in persisted settings — since they belong to one generation. They belong
 * to one song too: opening another song's ADD LAYER starts it empty (`openSong`), while
 * leaving the Editor and coming back to the same song keeps them. */
interface AddLayerDraft {
  songId: string | null;
  lyrics: string;
  /** The dock mounted for `songId`: a different song than the draft's starts over. */
  openSong: (songId: string) => void;
  setLyrics: (v: string) => void;
  reset: () => void;
}

export const useAddLayerDraft = create<AddLayerDraft>((set, get) => ({
  songId: null,
  lyrics: '',
  openSong: (songId) => { if (get().songId !== songId) set({ songId, lyrics: '' }); },
  setLyrics: (v) => set({ lyrics: v }),
  reset: () => set({ lyrics: '' }),
}));
