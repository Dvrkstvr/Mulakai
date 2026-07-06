import { create } from 'zustand';
import { api } from './api';
import type { CreateDraft } from './createDraft';

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
}

interface GenerationState {
  job: GenerationJob | null;
  /** Kicks off a song generation, then polls it to completion independent of whatever
   * view is mounted — CreateView calls this and navigates away immediately afterward. */
  start: (params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>, draft: CreateDraft) => Promise<void>;
  /** Clears a failed job (called right before navigating back to Create for a retry). */
  dismiss: () => void;
  /** Rehydrates from the server's generation lock — call once on app mount, in case a
   * generation was already in flight before a page refresh. */
  hydrate: () => Promise<void>;
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
      set((state) => (state.job?.jobId === jobId ? { job: { ...state.job, stage: s.status as GenStage } } : {}));
      continue;
    }
    if (s.status === 'done') {
      set((state) => (state.job?.jobId === jobId ? { job: { ...state.job, stage: 'done' } } : {}));
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

  start: async (params, draft) => {
    if (get().job) return; // one generation at a time, globally — see genLock.ts server-side
    const { title, prompt, lyrics } = params;
    const provisional: GenerationJob = {
      jobId: '', title, caption: prompt || lyrics || '', stage: 'loading', startedAt: Date.now(), draft,
    };
    set({ job: provisional });
    try {
      const { jobId } = await api.generate(params);
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
          draft: { prompt: active.caption },
        },
      });
      if (active.status === 'loading' || active.status === 'running') void pollJob(active.jobId, set);
    } catch {
      // ACE-Step/server unreachable at startup — health check elsewhere already surfaces this
    }
  },
}));
