import { create } from 'zustand';
import { api, type ActiveGeneration } from './api';

/**
 * Read-only mirror of the server's generation lock, polled independently of
 * generationStore/editorJobStore — this only feeds the header's dev status
 * pill (see Header.tsx) and has no side effects of its own beyond the abort call.
 */
interface ApiStatusState {
  active: ActiveGeneration | null;
  aborting: boolean;
  poll: () => Promise<void>;
  abort: () => Promise<void>;
}

export const useApiStatusStore = create<ApiStatusState>((set, get) => ({
  active: null,
  aborting: false,

  poll: async () => {
    if (get().aborting) return; // don't flicker the pill back in while an abort is settling
    try {
      const { active } = await api.activeGeneration();
      set({ active });
    } catch {
      // transient network hiccup — leave last-known state, same as generationStore.refreshLock
    }
  },

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
