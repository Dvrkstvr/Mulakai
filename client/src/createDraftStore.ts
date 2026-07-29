import { create } from 'zustand';
import type { StemKind } from './api';
import type { CreateDraft, GenType, Source } from './createDraft';

export type ArrangeSource = 'upload' | 'split';

/** The song intent — what you want made, independent of which task makes it. Shared by all
 * three tabs, because it was previously three independent copies in CreateView.tsx /
 * CreateAudioTab.tsx / CreateArrangeTab.tsx and the tabs are conditionally rendered, so
 * switching tabs unmounted one copy and silently discarded whatever was typed into it. */
interface SharedIntent {
  genType: GenType;
  title: string;
  prompt: string;
  lyrics: string;
  bpm: number;            // 0 = AUTO
  keyScale: string;       // '' = AUTO
  timeSignature: string;  // '' = AUTO
  vocalLanguage: string;  // '' = AUTO
  duration: number;       // 0 = AUTO (seconds)
  /** True once prompt/lyrics came from the LM (feeling lucky, refine accept, or the Quick
   * Start reveal) — AI ENHANCE re-formatting already-formatted text is what produced
   * ACE-Step's LM decoding-artifact garbage, so generate() suppresses use_format for this
   * draft until the user edits prompt/lyrics by hand again. */
  formatted: boolean;
  folderId?: string;
  folderName?: string;
  pendingQuery?: string;
  reusedFrom?: string;
  /** Reference-audio conditioning to re-apply, from a reused song — resolved against the saved
   * voices by CreateView (voiceStore's restoreReference). Influences are absent for
   * cover/complete origins, which never persisted them. */
  referenceLabel?: string;
  referenceAudioInfluence?: number;
  referenceStyleInfluence?: number;
  /** Which tab last authored `prompt`/`lyrics`. A prompt means a different thing in each tab
   * (a whole song from scratch / a change to a source / an accompaniment), so when this
   * doesn't match `genType` the tab names the shift (CarriedPromptNote.tsx) and ANALYZE AUDIO
   * is allowed to overwrite the text (useAnalyzeSourceAudio.ts). */
  intentOrigin: GenType;
}

/** COVER tab state — meaningless to the other tabs, so it stays out of SharedIntent, but
 * still in the store so bouncing to PROMPT and back doesn't drop a picked source or model. */
interface AudioMethod {
  source: Source;
  selectedSongId: string | null;
  uploadFile: File | null;
  model: string;
  /** 0-1, inverse of audio_cover_strength — see CreateAudioTab.tsx. */
  variance: number;
}

/** ARRANGE tab state, same reasoning as AudioMethod. */
interface ArrangeMethod {
  source: ArrangeSource;
  uploadFile: File | null;
  scratchSource: { jobId: string; kind: StemKind } | null;
  model: string;
}

const INTENT: SharedIntent = {
  genType: 'prompt', title: '', prompt: '', lyrics: '', bpm: 0, keyScale: '', timeSignature: '',
  vocalLanguage: '', duration: 0, formatted: false, intentOrigin: 'prompt',
  folderId: undefined, folderName: undefined, pendingQuery: undefined, reusedFrom: undefined,
  referenceLabel: undefined, referenceAudioInfluence: undefined, referenceStyleInfluence: undefined,
};
const AUDIO: AudioMethod = { source: 'upload', selectedSongId: null, uploadFile: null, model: '', variance: 0.5 };
const ARRANGE: ArrangeMethod = { source: 'upload', uploadFile: null, scratchSource: null, model: '' };

interface CreateDraftState extends SharedIntent {
  audio: AudioMethod;
  arrange: ArrangeMethod;
  /** Update shared intent. Touching prompt/lyrics claims them for the tab in view, since every
   * writer of those (typing, REFINE, FEELING LUCKY, ANALYZE AUDIO, the thinking reveal) acts
   * inside the tab you're looking at — only `load` brings text in from somewhere else. */
  patch: (p: Partial<SharedIntent>) => void;
  patchAudio: (p: Partial<AudioMethod>) => void;
  patchArrange: (p: Partial<ArrangeMethod>) => void;
  /** Replace the draft from an explicit intent — a create-bar query, REUSE PROMPT, CREATE
   * COVER FROM AUDIO, or RETRY. Wholesale, never merged: what you asked for is what you get. */
  load: (d: CreateDraft) => void;
  /** Re-entering Create with nothing new to say (the create bar's CREATE on an empty box):
   * keep the draft and only re-point its destination at the folder now in scope. */
  resume: (folderId?: string, folderName?: string) => void;
  /** Called once the thinking reveal has landed, so remounting the PROMPT tab (a tab switch,
   * or leaving and re-entering Create) doesn't fire the same LM expansion again. */
  clearPendingQuery: () => void;
}

/** In-memory only, deliberately: `uploadFile` is a `File` and can't be serialized, and a
 * week-old draft resurrecting itself on a fresh load is worse than retyping a prompt. */
export const useCreateDraftStore = create<CreateDraftState>()((set, get) => ({
  ...INTENT,
  audio: AUDIO,
  arrange: ARRANGE,

  patch: (p) => set('prompt' in p || 'lyrics' in p ? { ...p, intentOrigin: get().genType } : p),
  patchAudio: (p) => set({ audio: { ...get().audio, ...p } }),
  patchArrange: (p) => set({ arrange: { ...get().arrange, ...p } }),

  load: (d) => set({
    ...INTENT,
    genType: d.genType ?? INTENT.genType,
    intentOrigin: d.genType ?? INTENT.intentOrigin,
    prompt: d.prompt ?? '',
    lyrics: d.lyrics ?? '',
    bpm: d.bpm ?? 0,
    keyScale: d.keyScale ?? '',
    timeSignature: d.timeSignature ?? '',
    duration: d.duration ?? 0,
    folderId: d.folderId,
    folderName: d.folderName,
    pendingQuery: d.pendingQuery,
    reusedFrom: d.reusedFrom,
    referenceLabel: d.referenceLabel,
    referenceAudioInfluence: d.audioInfluence,
    referenceStyleInfluence: d.styleInfluence,
    audio: { ...AUDIO, source: d.source ?? AUDIO.source, selectedSongId: d.selectedSongId ?? null },
    arrange: ARRANGE,
  }),

  resume: (folderId, folderName) => set({ folderId, folderName }),
  clearPendingQuery: () => set({ pendingQuery: undefined }),
}));
