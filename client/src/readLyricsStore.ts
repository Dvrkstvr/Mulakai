/** READ LYRICS (PLAN.md "READ LYRICS on COVER · YUE2"): send the cover's source to lyrics-server
 * through the Mulakai server, poll the job like any other, and place the words into LYRICS by
 * when they are sung. Keeps the reading, so LYRICS it wrote can follow the score (a score
 * landing, TRANSCRIBE AGAIN, a section left out) until the user edits them. */
import { create } from 'zustand';
import { api, type LyricsReading } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { coverSourceKey } from './coverSource';
import { placeReading, type Placement } from './lyricsPlacement';
import { POLL_MS } from './transcribeStore';

interface ReadLyricsState {
  stage: 'idle' | 'running' | 'failed';
  error?: string;
  /** The last finished reading, and the draft source it was read from. */
  reading: LyricsReading | null;
  sourceKey: string | null;
  /** LYRICS exactly as READ LYRICS last wrote them. While LYRICS still holds this, they are
   * READ LYRICS' own and follow the score; once edited they are the user's. */
  placed: string | null;
  /** How the last placement went, for the outcome line. */
  outcome: Placement | null;
  /** The VOCAL LANGUAGE READ LYRICS filled in itself. While VOCAL LANGUAGE still holds it, the
   * next read auto-detects again: forcing a language that was only a guess made Whisper
   * translate a German song's verses into English (PLAN.md "READ LYRICS on COVER · YUE2"). */
  filledLanguage: string | null;
  /** `language` '' = auto-detect. `sings` is the engine's languages: an AUTO VOCAL LANGUAGE takes
   * the one heard only when the engine sings it, as ANALYZE AUDIO does. */
  start: (srcAudio: Blob, label: string, language: string, sings: string[] | 'any') => Promise<void>;
  /** Re-place the reading if LYRICS are still READ LYRICS' own; otherwise a no-op. */
  follow: () => void;
  reset: () => void;
}

const IDLE = {
  stage: 'idle', error: undefined, reading: null, sourceKey: null, placed: null, outcome: null, filledLanguage: null,
} as const;

/** Place `reading` into LYRICS against the draft's current score. */
function place(reading: LyricsReading): Placement {
  const draft = useCreateDraftStore.getState();
  const placement = placeReading(reading.segments, draft.audio.yueScore);
  if (placement.lyrics !== draft.lyrics) draft.patch({ lyrics: placement.lyrics });
  return placement;
}

export const useReadLyricsStore = create<ReadLyricsState>((set, get) => ({
  ...IDLE,

  reset: () => set({ ...IDLE }),

  follow: () => {
    const { reading, placed, sourceKey } = get();
    if (!reading || placed === null) return;
    const draft = useCreateDraftStore.getState();
    if (coverSourceKey(draft.audio) !== sourceKey) {
      set({ ...IDLE }); // the reading described a source that is no longer picked
      return;
    }
    if (draft.lyrics !== placed) return;
    const outcome = place(reading);
    set({ placed: outcome.lyrics, outcome });
  },

  start: async (srcAudio, label, language, sings) => {
    if (get().stage === 'running') return;
    const sourceKey = coverSourceKey(useCreateDraftStore.getState().audio);
    set({ stage: 'running', error: undefined });
    if (language && language === get().filledLanguage) language = '';
    const fail = (err: unknown) => set({ stage: 'failed', error: err instanceof Error ? err.message : String(err) });
    let jobId: string;
    try {
      ({ jobId } = await api.readLyrics(srcAudio, label, language));
    } catch (err) {
      fail(err);
      return;
    }
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let s: Awaited<ReturnType<typeof api.jobStatus>>;
      try {
        s = await api.jobStatus(jobId);
      } catch {
        continue; // a network hiccup is not a failed read
      }
      if (s.status === 'loading' || s.status === 'running') continue;
      if (s.status === 'failed' || !s.lyrics) {
        fail(s.error ?? 'reading the lyrics failed');
        return;
      }
      const draft = useCreateDraftStore.getState();
      if (coverSourceKey(draft.audio) !== sourceKey) {
        set({ stage: 'idle' }); // picked away from while it read: not this source's words
        return;
      }
      const reading = s.lyrics;
      const outcome = place(reading);
      let filledLanguage = get().filledLanguage;
      const auto = !draft.vocalLanguage || draft.vocalLanguage === filledLanguage;
      if (auto && reading.language && (sings === 'any' || sings.includes(reading.language))) {
        draft.patch({ vocalLanguage: reading.language });
        filledLanguage = reading.language;
      } else if (auto && filledLanguage) {
        draft.patch({ vocalLanguage: '' }); // our own guess was wrong: back to AUTO
        filledLanguage = null;
      }
      set({ stage: 'idle', reading, sourceKey, placed: outcome.lyrics, outcome, filledLanguage });
      return;
    }
  },
}));
