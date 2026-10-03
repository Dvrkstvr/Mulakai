import { create } from 'zustand';
import { api, type ActiveGeneration } from './api';

/**
 * Read-only mirror of the server's generation lock, polled independently of
 * generationStore/editorJobStore — it feeds Activity's RUNNING rows (a job no store
 * here tracks, and which row ABORT belongs to) and has no side effects beyond the abort call.
 */
interface ApiStatusState {
  active: ActiveGeneration | null;
  aborting: boolean;
  /** Bumped by `lockReleased`, so a poll answered after it can't restore the old holder. */
  epoch: number;
  poll: () => Promise<void>;
  /** A job this tab tracks has settled: drop a snapshot that names it, so Activity doesn't list
   * it as RUNNING beside its DONE row until the next poll, and discard any poll already in flight.
   * Matched by the lock's jobId (`''` = the server never accepted it, so it never held the lock),
   * or by kind for the stores that keep no jobId (transcribe, lyrics, timings). */
  lockReleased: (kind: ActiveGeneration['kind'], jobId?: string) => void;
  abort: () => Promise<void>;
}

export const useApiStatusStore = create<ApiStatusState>((set, get) => ({
  active: null,
  aborting: false,
  epoch: 0,

  poll: async () => {
    if (get().aborting) return; // don't flicker the pill back in while an abort is settling
    const { epoch } = get();
    try {
      const { active } = await api.activeGeneration();
      if (get().epoch === epoch) set({ active });
    } catch {
      // transient network hiccup — leave last-known state, same as generationStore.refreshLock
    }
  },

  lockReleased: (kind, jobId) => set((s) => {
    const named = !!s.active && (jobId !== undefined ? s.active.jobId === jobId : s.active.kind === kind);
    return { epoch: s.epoch + 1, ...(named ? { active: null } : {}) };
  }),

  abort: async () => {
    if (!get().active || get().aborting) return;
    set({ aborting: true });
    try {
      await api.abortActive();
    } finally {
      set({ aborting: false, active: null });
    }
  },
}));
