/** The engine list from `GET /api/engines` (ACE-Step first, with live health). Fetched when
 * Create or Settings mounts and on the header status badge's slow refresh (modelStatusStore):
 * health only gates the picker, and the server re-checks everything when a generation is
 * actually submitted. */
import { create } from 'zustand';
import { api, type EngineId, type EngineInfo } from './api';

interface EngineState {
  engines: EngineInfo[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useEngineStore = create<EngineState>((set) => ({
  engines: [],
  loaded: false,
  load: async () => {
    try {
      set({ engines: await api.engines(), loaded: true });
    } catch {
      // An old server without /api/engines, or the server down: behave as ACE-Step only.
      set({ engines: [], loaded: true });
    }
  },
}));

/** The descriptor for an extra engine; null for ACE-Step or an engine the server didn't list. */
export const extraEngine = (engines: EngineInfo[], id: EngineId): EngineInfo | null =>
  id === 'acestep' ? null : engines.find((e) => e.id === id) ?? null;
