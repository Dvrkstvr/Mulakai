import { create } from 'zustand';
import { api, type Voice } from './api';

/** Which reference-audio branch is showing in ReferenceAudioPicker. Lives here rather than as
 * the picker's local state because the selection it describes lives here: the picker remounts
 * on every Create visit, and REUSE PROMPT / CLEAR DRAFT change the selection from outside it,
 * so local state would show NONE over a voice that voiceParams() would still send. */
export type RefMode = 'none' | 'voice' | 'upload';

interface VoiceState {
  voices: Voice[];
  refMode: RefMode;
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
  setRefMode: (m: RefMode) => void;
  selectVoice: (id: string | null) => void;
  setUploadedRefFile: (f: File | null) => void;
  setAudioInfluence: (v: number) => void;
  setStyleInfluence: (v: number) => void;
  /** Drop the whole reference-audio choice — used by Create's CLEAR DRAFT, since a voice left
   * selected would keep conditioning generations from a draft the user just emptied. */
  clearReference: () => void;
  /** Re-apply a song's reference-audio conditioning (Library REUSE PROMPT — see
   * createDraft.ts). Matched by name, since the voice *name* is all a song records. */
  restoreReference: (label?: string, audioInfluence?: number, styleInfluence?: number) => Promise<void>;
}

/** Global voice library selection — resets per session like CreateView's selectedSongId, not persisted (the voice list itself lives server-side). */
export const useVoiceStore = create<VoiceState>()((set, get) => ({
  voices: [],
  refMode: 'none',
  selectedVoiceId: null,
  uploadedRefFile: null,
  audioInfluence: 0.5,
  styleInfluence: 0.5,
  missingReferenceLabel: null,
  fetchVoices: async () => {
    const voices = await api.listVoices();
    set({ voices });
  },
  setRefMode: (m) => set({
    refMode: m,
    // ACE-Step accepts one reference_audio per request, so switching branch drops the other.
    ...(m !== 'voice' ? { selectedVoiceId: null } : {}),
    ...(m !== 'upload' ? { uploadedRefFile: null } : {}),
  }),
  selectVoice: (id) => {
    const voice = id ? get().voices.find((v) => v.id === id) : undefined;
    set({
      selectedVoiceId: id,
      uploadedRefFile: id ? null : get().uploadedRefFile,
      missingReferenceLabel: null,
      ...(id ? { refMode: 'voice' as RefMode } : {}),
      ...(voice ? { audioInfluence: voice.default_audio_influence, styleInfluence: voice.default_style_influence } : {}),
    });
  },
  setUploadedRefFile: (f) => set({
    uploadedRefFile: f, missingReferenceLabel: null,
    ...(f ? { selectedVoiceId: null, refMode: 'upload' as RefMode } : {}),
  }),
  setAudioInfluence: (v) => set({ audioInfluence: v }),
  setStyleInfluence: (v) => set({ styleInfluence: v }),
  clearReference: () => set({
    refMode: 'none', selectedVoiceId: null, uploadedRefFile: null,
    audioInfluence: 0.5, styleInfluence: 0.5, missingReferenceLabel: null,
  }),

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
    get().selectVoice(voice.id); // sets refMode 'voice', resets influences to its defaults...
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
