import { create } from 'zustand';
import { api, type Voice } from './api';

interface VoiceState {
  voices: Voice[];
  selectedVoiceId: string | null;
  audioInfluence: number; // 0-1
  styleInfluence: number; // 0-1
  fetchVoices: () => Promise<void>;
  selectVoice: (id: string | null) => void;
  setAudioInfluence: (v: number) => void;
  setStyleInfluence: (v: number) => void;
}

/** Global voice library selection — resets per session like CreateView's selectedSongId, not persisted (the voice list itself lives server-side). */
export const useVoiceStore = create<VoiceState>()((set, get) => ({
  voices: [],
  selectedVoiceId: null,
  audioInfluence: 0.5,
  styleInfluence: 0.5,
  fetchVoices: async () => {
    const voices = await api.listVoices();
    set({ voices });
  },
  selectVoice: (id) => {
    const voice = id ? get().voices.find((v) => v.id === id) : undefined;
    set({
      selectedVoiceId: id,
      ...(voice ? { audioInfluence: voice.default_audio_influence, styleInfluence: voice.default_style_influence } : {}),
    });
  },
  setAudioInfluence: (v) => set({ audioInfluence: v }),
  setStyleInfluence: (v) => set({ styleInfluence: v }),
}));

/** Params to spread into api.generate()/api.addLayer() when a voice is selected. */
export function voiceParams(s: Pick<VoiceState, 'selectedVoiceId' | 'audioInfluence' | 'styleInfluence'>) {
  if (!s.selectedVoiceId) return {};
  return { voiceId: s.selectedVoiceId, audio_influence: s.audioInfluence, style_influence: s.styleInfluence };
}
