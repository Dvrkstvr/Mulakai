import { create } from 'zustand';
import { api, type StemKind } from './api';
import { taskToGenType, type CreateDraft } from './createDraft';

export type GenStage = 'loading' | 'running' | 'done' | 'failed';

export interface GenerationJob {
  jobId: string;
  title: string;
  caption: string;
  stage: GenStage;
  error?: string;
  startedAt: number;
  /** Prefills the Create screen if the user hits RETRY. */
  draft: CreateDraft;
  /** Set once the job finishes — the new song's id, so the caller can load it into the player. */
  songId?: string;
  /** Live progress from ACE-Step's /query_result, refreshed each poll tick while running. */
  progress?: number;
  progressStage?: string;
  progressText?: string;
}

/** A generation lock held by something other than a song-generation job (repaint,
 * regenerate, retake, add layer, split, remaster) — tracked only enough to let other
 * screens proactively disable their own triggers instead of firing and getting a 409. */
export interface OtherLock {
  kind: string;
  songId?: string;
}

interface GenerationState {
  job: GenerationJob | null;
  otherLock: OtherLock | null;
  /** Kicks off a song generation, then polls it to completion independent of whatever
   * view is mounted — CreateView calls this and navigates away immediately afterward. */
  start: (
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    draft: CreateDraft,
    referenceAudio?: Blob,
  ) => Promise<void>;
  /** Same as `start`, but conditioned on a source audio file — CreateView's AUDIO tab (create
   * cover from audio). Persists as a new song exactly like `start`, just via a different endpoint. */
  startFromAudio: (
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    srcAudio: Blob,
    draft: CreateDraft,
    referenceAudio?: Blob,
  ) => Promise<void>;
  /** Same shape again, for CreateView's COMPLETE tab — a `complete` generation that builds a
   * whole accompaniment around a single bare source track, with an optional reference audio
   * file for style/timbre. Persists as a new song exactly like `start`/`startFromAudio`. */
  startComplete: (
    params: { title: string; prompt?: string } & Record<string, unknown>,
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    draft: CreateDraft,
    referenceAudio?: Blob,
  ) => Promise<void>;
  /** Clears a failed job (called right before navigating back to Create for a retry). */
  dismiss: () => void;
  /** Rehydrates from the server's generation lock — call once on app mount, in case a
   * generation was already in flight before a page refresh. */
  hydrate: () => Promise<void>;
  /** Polls the server's generation lock so `otherLock` stays live — see App.tsx's interval.
   * A no-op while a song-generation `job` is already tracked in detail. */
  refreshLock: () => Promise<void>;
}

const POLL_MS = 2000;
/** How long the shrunk "done" card lingers before it's cleared, giving the shrink
 * transition somewhere to land before the real song row (from the library refresh)
 * takes its place. */
const DONE_LINGER_MS = 900;

async function pollJob(jobId: string, set: (fn: (s: GenerationState) => Partial<GenerationState>) => void) {
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let s: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      s = await api.jobStatus(jobId);
    } catch {
      continue; // transient network hiccup — keep polling rather than surfacing a false failure
    }
    if (s.status === 'loading' || s.status === 'running') {
      set((state) => (state.job?.jobId === jobId
        ? { job: { ...state.job, stage: s.status as GenStage, progress: s.progress, progressStage: s.progressStage, progressText: s.progressText } }
        : {}));
      continue;
    }
    if (s.status === 'done') {
      set((state) => (state.job?.jobId === jobId ? { job: { ...state.job, stage: 'done', songId: s.songId } } : {}));
      setTimeout(() => {
        set((state) => (state.job?.jobId === jobId ? { job: null } : {}));
      }, DONE_LINGER_MS);
      return;
    }
    set((state) => (state.job?.jobId === jobId ? { job: { ...state.job, stage: 'failed', error: s.error ?? 'generation failed' } } : {}));
    return;
  }
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  job: null,
  otherLock: null,

  start: async (params, draft, referenceAudio) => {
    if (get().job) return; // one generation at a time, globally — see genLock.ts server-side
    const { title, prompt, lyrics } = params;
    const provisional: GenerationJob = {
      jobId: '', title, caption: prompt || lyrics || '', stage: 'loading', startedAt: Date.now(), draft,
    };
    set({ job: provisional });
    try {
      const { jobId } = await api.generate(params, referenceAudio);
      set((state) => (state.job === provisional ? { job: { ...provisional, jobId } } : {}));
      void pollJob(jobId, set);
    } catch (err) {
      set((state) => (state.job === provisional
        ? { job: { ...provisional, stage: 'failed', error: err instanceof Error ? err.message : String(err) } }
        : {}));
    }
  },

  startFromAudio: async (params, srcAudio, draft, referenceAudio) => {
    if (get().job) return; // one generation at a time, globally — see genLock.ts server-side
    const { title, prompt, lyrics } = params;
    const provisional: GenerationJob = {
      jobId: '', title, caption: prompt || lyrics || '', stage: 'loading', startedAt: Date.now(), draft,
    };
    set({ job: provisional });
    try {
      const { jobId } = await api.generateFromAudio(srcAudio, params, referenceAudio);
      set((state) => (state.job === provisional ? { job: { ...provisional, jobId } } : {}));
      void pollJob(jobId, set);
    } catch (err) {
      set((state) => (state.job === provisional
        ? { job: { ...provisional, stage: 'failed', error: err instanceof Error ? err.message : String(err) } }
        : {}));
    }
  },

  startComplete: async (params, source, draft, referenceAudio) => {
    if (get().job) return; // one generation at a time, globally — see genLock.ts server-side
    const { title, prompt } = params;
    const provisional: GenerationJob = {
      jobId: '', title, caption: prompt ?? '', stage: 'loading', startedAt: Date.now(), draft,
    };
    set({ job: provisional });
    try {
      const { jobId } = await api.generateComplete(source, params, referenceAudio);
      set((state) => (state.job === provisional ? { job: { ...provisional, jobId } } : {}));
      void pollJob(jobId, set);
    } catch (err) {
      set((state) => (state.job === provisional
        ? { job: { ...provisional, stage: 'failed', error: err instanceof Error ? err.message : String(err) } }
        : {}));
    }
  },

  dismiss: () => set({ job: null }),

  hydrate: async () => {
    if (get().job) return;
    try {
      const { active } = await api.activeGeneration();
      if (!active || active.kind !== 'generate') return;
      set({
        job: {
          jobId: active.jobId,
          title: active.title ?? 'Untitled',
          caption: active.caption ?? '',
          stage: active.status,
          error: active.error,
          startedAt: active.startedAt,
          // A rehydrated job has no draft to recover (it was submitted before this page load),
          // but the lock knows which task is running — enough for RETRY to reopen the tab that
          // started it instead of always dropping into PROMPT.
          draft: { genType: taskToGenType(active.task), prompt: active.caption },
        },
      });
      if (active.status === 'loading' || active.status === 'running') void pollJob(active.jobId, set);
    } catch {
      // ACE-Step/server unreachable at startup — health check elsewhere already surfaces this
    }
  },

  refreshLock: async () => {
    if (get().job) {
      if (get().otherLock) set({ otherLock: null }); // our own job holds the lock — nothing "other" to report
      return;
    }
    try {
      const { active } = await api.activeGeneration();
      if (!active) {
        if (get().otherLock) set({ otherLock: null });
        return;
      }
      if (active.kind === 'generate') {
        // A song generation started elsewhere (e.g. another tab) — adopt it as our own job
        // so the library card and CreateBar pick it up, same as hydrate() does on mount.
        set({
          otherLock: null,
          job: {
            jobId: active.jobId, title: active.title ?? 'Untitled', caption: active.caption ?? '',
            stage: active.status, error: active.error, startedAt: active.startedAt,
            draft: { genType: taskToGenType(active.task), prompt: active.caption },
          },
        });
        if (active.status === 'loading' || active.status === 'running') void pollJob(active.jobId, set);
        return;
      }
      set({ otherLock: { kind: active.kind, songId: active.songId } });
    } catch {
      // transient — leave otherLock as-is rather than flicker it off on a network hiccup
    }
  },
}));
