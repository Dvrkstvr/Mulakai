import { create } from 'zustand';
import { api, type Voice } from './api';

interface VoiceState {
  voices: Voice[];
  selectedVoiceId: string | null;
  /** An ad-hoc uploaded reference clip — mutually exclusive with selectedVoiceId (see
   * ReferenceAudioPicker.tsx; AddLayerTrigger.tsx's VoicePicker never sets this, since it has
   * no upload UI, so Add Layer is unaffected by this field's existence). */
  uploadedRefFile: File | null;
  audioInfluence: number; // 0-1
  styleInfluence: number; // 0-1
  /** A reused draft's reference-audio label that resolved to nothing — surfaced by
   * ReferenceAudioPicker instead of silently generating without the conditioning the
   * original song had. Cleared as soon as the user picks any reference themselves. */
  missingReferenceLabel: string | null;
  fetchVoices: () => Promise<void>;
  selectVoice: (id: string | null) => void;
  setUploadedRefFile: (f: File | null) => void;
  setAudioInfluence: (v: number) => void;
  setStyleInfluence: (v: number) => void;
  /** Re-apply a song's reference-audio conditioning (Library REUSE PROMPT — see
   * createDraft.ts). Matched by name, since the voice *name* is all a song records. */
  restoreReference: (label?: string, audioInfluence?: number, styleInfluence?: number) => Promise<void>;
}

/** Global voice library selection — resets per session like CreateView's selectedSongId, not persisted (the voice list itself lives server-side). */
export const useVoiceStore = create<VoiceState>()((set, get) => ({
  voices: [],
  selectedVoiceId: null,
  uploadedRefFile: null,
  audioInfluence: 0.5,
  styleInfluence: 0.5,
  missingReferenceLabel: null,
  fetchVoices: async () => {
    const voices = await api.listVoices();
    set({ voices });
  },
  selectVoice: (id) => {
    const voice = id ? get().voices.find((v) => v.id === id) : undefined;
    set({
      selectedVoiceId: id,
      uploadedRefFile: id ? null : get().uploadedRefFile,
      missingReferenceLabel: null,
      ...(voice ? { audioInfluence: voice.default_audio_influence, styleInfluence: voice.default_style_influence } : {}),
    });
  },
  setUploadedRefFile: (f) => set({ uploadedRefFile: f, missingReferenceLabel: null, ...(f ? { selectedVoiceId: null } : {}) }),
  setAudioInfluence: (v) => set({ audioInfluence: v }),
  setStyleInfluence: (v) => set({ styleInfluence: v }),

  restoreReference: async (label, audioInfluence, styleInfluence) => {
    if (!label) {
      set({ missingReferenceLabel: null });
      return;
    }
    if (get().voices.length === 0) await get().fetchVoices().catch(() => {});
    const voice = get().voices.find((v) => v.name === label);
    if (!voice) {
      // Either the voice was deleted or the label is an ad-hoc uploaded clip's filename,
      // which is never saved — indistinguishable from what a song stores, so the picker's
      // warning covers both rather than guessing.
      set({ missingReferenceLabel: label });
      return;
    }
    get().selectVoice(voice.id); // resets influences to this voice's defaults...
    set({                        // ...so the song's own values have to be applied after it.
      ...(audioInfluence != null ? { audioInfluence } : {}),
      ...(styleInfluence != null ? { styleInfluence } : {}),
    });
  },
}));

/** Params to spread into api.generate()/api.addLayer() when a voice is selected. */
export function voiceParams(s: Pick<VoiceState, 'selectedVoiceId' | 'audioInfluence' | 'styleInfluence'>) {
  if (!s.selectedVoiceId) return {};
  return { voiceId: s.selectedVoiceId, audio_influence: s.audioInfluence, style_influence: s.styleInfluence };
}
