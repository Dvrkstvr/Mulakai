import { create } from 'zustand';

/** Per-invocation Add Layer lyrics, written by the dock's lyrics field
 * (DockAddLayerFields) and read when ADD LAYER commits (DockAddLayer). Lyrics live
 * here — not in persisted settings — since they belong to one generation. */
interface AddLayerDraft {
  lyrics: string;
  setLyrics: (v: string) => void;
  reset: () => void;
}

export const useAddLayerDraft = create<AddLayerDraft>((set) => ({
  lyrics: '',
  setLyrics: (v) => set({ lyrics: v }),
  reset: () => set({ lyrics: '' }),
}));
