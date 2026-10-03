/** TRANSCRIBE for a cover (PLAN.md "Client cover decisions"): send the source to the engine's
 * SheetSage2, poll the job like any other, and put the score into COVER's draft. Its own store
 * because generationStore.ts is at the module cap, and because nothing here makes a song. */
import { create } from 'zustand';
import { api, ApiError, type EngineId } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { coverSourceKey } from './coverSource';
import { fitLyricsToSections, hasWords } from './coverLyrics';
import { JOB_GONE } from './jobGone';

export const POLL_MS = 1500;

interface TranscribeState {
  stage: 'idle' | 'running' | 'failed';
  /** SheetSage2's share of windows done, while running. */
  progress?: number;
  error?: string;
  /** The draft source this run reads (coverSourceKey), so a result for a source picked away
   * from in the meantime is dropped rather than shown against the wrong song. */
  sourceKey: string | null;
  /** LYRICS as ANALYZE AUDIO wrote them before there was a score (YueCoverAnalyze.tsx). While
   * LYRICS still holds exactly this, a landing score re-tags them onto its sections; once
   * edited they are the user's (PLAN.md "ANALYZE AUDIO on COVER · YUE2", point 4). */
  analyzedLyrics: string | null;
  /** `seedLyrics` fills an empty LYRICS once the score lands: a library source's own words,
   * re-tagged to the score's sections, or '' for just the section outline. Resolves true when
   * the score landed on the same source over LYRICS with none of the user's words — none at
   * all, or ANALYZE AUDIO's still untouched — so READ LYRICS may fill them unasked (PLAN.md
   * "READ LYRICS With TRANSCRIBE for Uploads", decision 3). */
  start: (engine: EngineId, srcAudio: Blob, label: string, seedLyrics: string) => Promise<boolean>;
  /** Runs the last `start` again (Activity's RETRY on a failed transcription). False when
   * nothing started: one is already running, or there was no earlier run. */
  retry: () => boolean;
  reset: () => void;
}

let lastStart: Parameters<TranscribeState['start']> | null = null;

export const useTranscribeStore = create<TranscribeState>((set, get) => ({
  stage: 'idle',
  sourceKey: null,
  analyzedLyrics: null,

  reset: () => set({ stage: 'idle', progress: undefined, error: undefined, sourceKey: null, analyzedLyrics: null }),

  retry: () => {
    if (!lastStart || get().stage === 'running') return false;
    void get().start(...lastStart);
    return true;
  },

  start: async (engine, srcAudio, label, seedLyrics) => {
    if (get().stage === 'running') return false;
    lastStart = [engine, srcAudio, label, seedLyrics];
    const sourceKey = coverSourceKey(useCreateDraftStore.getState().audio);
    set({ stage: 'running', progress: undefined, error: undefined, sourceKey });
    const fail = (err: unknown) => {
      set({ stage: 'failed', error: err instanceof Error ? err.message : String(err) });
      return false;
    };
    let jobId: string;
    try {
      ({ jobId } = await api.transcribe(engine, srcAudio, label));
    } catch (err) {
      return fail(err);
    }
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let s: Awaited<ReturnType<typeof api.jobStatus>>;
      try {
        s = await api.jobStatus(jobId);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) continue; // a network hiccup is not a failed transcription
        s = { status: 'failed', error: JOB_GONE };
      }
      if (s.status === 'loading' || s.status === 'running') {
        set({ progress: s.progress });
        continue;
      }
      if (s.status === 'failed' || !s.transcription) return fail(s.error ?? 'transcription failed');
      const draft = useCreateDraftStore.getState();
      let open = false;
      if (coverSourceKey(draft.audio) === sourceKey) {
        const t = s.transcription;
        const analyzed = draft.lyrics === get().analyzedLyrics;
        draft.patchAudio({ yueScore: { abc: t.score, source: t.sourceLabel, transcription: t, previewJobId: jobId } });
        if (!draft.lyrics.trim()) draft.patch({ lyrics: fitLyricsToSections(seedLyrics, t.score) });
        else if (analyzed) draft.patch({ lyrics: fitLyricsToSections(draft.lyrics, t.score) });
        open = analyzed || !hasWords(useCreateDraftStore.getState().lyrics);
      }
      set({ stage: 'idle', progress: undefined, sourceKey: null, analyzedLyrics: null });
      return open;
    }
  },
}));
