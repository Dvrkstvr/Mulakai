/** Live health of every model/service behind the header's status badge. ACE-Step is polled
 * by the app shell (useAppSync) since Settings reads it too; the rest refresh on the badge's
 * own slower timer and whenever its popover opens. Extra engines stay in engineStore, so
 * Create's engine picker sees the same answer. */
import { create } from 'zustand';
import { api, type SplitHealth } from './api';
import { useEngineStore } from './engineStore';
import type { AcestepState } from './modelStatus';

interface ModelStatusState {
  acestep: AcestepState | null;
  split: SplitHealth | null;
  lyrics: { configured: boolean; ready: boolean } | null;
  checkAcestep: () => Promise<void>;
  checkServices: () => Promise<void>;
}

// A split probe can wait on a busy ACE-Step for a minute; don't stack a second one behind it.
let servicesInFlight: Promise<void> | null = null;

export const useModelStatusStore = create<ModelStatusState>((set) => ({
  acestep: null,
  split: null,
  lyrics: null,

  checkAcestep: async () => {
    try {
      const h = await api.acestepHealth();
      set({ acestep: h.acestep ? 'online' : h.busy ? 'busy' : 'offline' });
    } catch {
      set({ acestep: 'offline' });
    }
  },

  checkServices: () => {
    // Each answer lands on its own; a failed fetch keeps the last known state.
    servicesInFlight ??= Promise.allSettled([
      useEngineStore.getState().load(),
      api.splitHealth().then((split) => set({ split })),
      api.lyricsHealth().then((lyrics) => set({ lyrics })),
    ]).then(() => { servicesInFlight = null; });
    return servicesInFlight;
  },
}));

/** The app-wide boolean older screens take: a busy ACE-Step is still online. */
export const isAcestepOnline = (s: AcestepState | null): boolean | null => (s === null ? null : s !== 'offline');
