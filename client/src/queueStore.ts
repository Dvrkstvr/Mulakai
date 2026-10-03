import { create } from 'zustand';
import { api, type QueueEntry, type QueueRunning } from './api';

/**
 * Read-only mirror of the server's job queue (PLAN.md "UI Redesign", S4), polled by the
 * header beside apiStatusStore: Activity's UP NEXT rows, and which RUNNING rows are really
 * still waiting. Holds every queued job, this tab's or another's.
 */
interface QueueState {
  running: QueueRunning | null;
  queued: QueueEntry[];
  /** Job ids whose CANCEL is in flight, so the row can't be pressed twice. */
  cancelling: string[];
  /** Why the last CANCEL failed: the job had started since the row was drawn (409), so it is
   * left running and the next poll moves it to RUNNING. */
  error: string | null;
  poll: () => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  running: null,
  queued: [],
  cancelling: [],
  error: null,

  poll: async () => {
    try {
      const { running, queued } = await api.queue();
      set({ running, queued });
    } catch {
      // transient — keep the last snapshot, same as apiStatusStore
    }
  },

  cancel: async (jobId) => {
    if (get().cancelling.includes(jobId)) return;
    set((s) => ({ cancelling: [...s.cancelling, jobId], error: null }));
    try {
      await api.cancelJob(jobId);
      // Leaves the list now, not a poll later; positions behind it close up on the next poll.
      set((s) => ({ queued: s.queued.filter((q) => q.jobId !== jobId) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set((s) => ({ cancelling: s.cancelling.filter((id) => id !== jobId) }));
      void get().poll();
    }
  },
}));
