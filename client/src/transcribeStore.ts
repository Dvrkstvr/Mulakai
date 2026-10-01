/** TRANSCRIBE for a cover (PLAN.md "Client cover decisions"): send the source to the engine's
 * SheetSage2, poll the job like any other, and put the score into COVER's draft. Its own store
 * because generationStore.ts is at the module cap, and because nothing here makes a song. */
import { create } from 'zustand';
import { api, type EngineId } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { coverSourceKey } from './coverSource';
import { fitLyricsToSections } from './coverLyrics';

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
   * re-tagged to the score's sections, or '' for just the section outline. */
  start: (engine: EngineId, srcAudio: Blob, label: string, seedLyrics: string) => Promise<void>;
  reset: () => void;
}

export const useTranscribeStore = create<TranscribeState>((set, get) => ({
  stage: 'idle',
  sourceKey: null,
  analyzedLyrics: null,

  reset: () => set({ stage: 'idle', progress: undefined, error: undefined, sourceKey: null, analyzedLyrics: null }),

  start: async (engine, srcAudio, label, seedLyrics) => {
    if (get().stage === 'running') return;
    const sourceKey = coverSourceKey(useCreateDraftStore.getState().audio);
    set({ stage: 'running', progress: undefined, error: undefined, sourceKey });
    const fail = (err: unknown) => set({ stage: 'failed', error: err instanceof Error ? err.message : String(err) });
    let jobId: string;
    try {
      ({ jobId } = await api.transcribe(engine, srcAudio, label));
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
        continue; // a network hiccup is not a failed transcription
      }
      if (s.status === 'loading' || s.status === 'running') {
        set({ progress: s.progress });
        continue;
      }
      if (s.status === 'failed' || !s.transcription) {
        fail(s.error ?? 'transcription failed');
        return;
      }
      const draft = useCreateDraftStore.getState();
      if (coverSourceKey(draft.audio) === sourceKey) {
        const t = s.transcription;
        draft.patchAudio({ yueScore: { abc: t.score, source: t.sourceLabel, transcription: t, previewJobId: jobId } });
        if (!draft.lyrics.trim()) draft.patch({ lyrics: fitLyricsToSections(seedLyrics, t.score) });
        else if (draft.lyrics === get().analyzedLyrics) draft.patch({ lyrics: fitLyricsToSections(draft.lyrics, t.score) });
      }
      set({ stage: 'idle', progress: undefined, sourceKey: null, analyzedLyrics: null });
      return;
    }
  },
}));
