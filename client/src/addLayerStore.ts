import { create } from 'zustand';

/** Per-invocation Add Layer draft shared between the compact footer trigger
 * (AddLayerTrigger, which owns the prompt + GENERATE button) and the left-rail
 * settings panel (SettingsPanel, which hosts the lyrics editor). Lyrics live
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
