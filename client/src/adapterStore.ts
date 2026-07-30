import { create } from 'zustand';
import { api, type Adapter } from './api';

interface AdapterState {
  adapters: Adapter[];
  /** null = generations run on the base model. */
  activeId: string | null;
  /** "Recorded, but ACE-Step hasn't applied it yet" — most often no model is loaded. Surfaced
   * rather than swallowed, since the app would otherwise claim an adapter that isn't in play. */
  warning: string | null;
  fetchAdapters: () => Promise<void>;
  register: (name: string, path: string) => Promise<void>;
  select: (id: string | null) => Promise<void>;
  setScale: (id: string, scale: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Server-owned state (ACE-Step holds one adapter at a time), so this store is a cache of it
 * rather than a source of truth — every mutation re-reads the list instead of patching locally. */
export const useAdapterStore = create<AdapterState>()((set, get) => ({
  adapters: [],
  activeId: null,
  warning: null,

  fetchAdapters: async () => {
    const { adapters, activeId } = await api.listAdapters();
    set({ adapters, activeId });
  },

  // Throws on rejection: registration validates by loading the path, so a failure is the
  // user's to fix (bad path, no model loaded) and the form shows ACE-Step's own message.
  register: async (name, path) => {
    await api.registerAdapter(name, path);
    await get().fetchAdapters();
  },

  select: async (id) => {
    const { activeId, warning } = await api.setActiveAdapter(id);
    set({ activeId, warning: warning ?? null });
  },

  setScale: async (id, scale) => {
    const { warning } = await api.setAdapterScale(id, scale);
    set({
      adapters: get().adapters.map((a) => (a.id === id ? { ...a, scale } : a)),
      warning: warning ?? null,
    });
  },

  remove: async (id) => {
    const { activeId, warning } = await api.deleteAdapter(id);
    set({
      adapters: get().adapters.filter((a) => a.id !== id),
      activeId,
      warning: warning ?? null,
    });
  },
}));

/** The active adapter's row, or null when generations run on the base model. */
export function activeAdapter(s: Pick<AdapterState, 'adapters' | 'activeId'>): Adapter | null {
  return s.adapters.find((a) => a.id === s.activeId) ?? null;
}

/**
 * What selecting this adapter actually does, stated before the fact per DESIGN.md's
 * consequence rule. It is deliberately blunt about the scope: ACE-Step has no per-request
 * adapter parameter, so one selection colours every generation in the app.
 */
export function adapterConsequence(active: Adapter | null): string {
  if (!active) return 'No adapter — generations run on the base model.';
  return `${active.name} at ${Math.round(active.scale * 100)}% applies to every generation, `
    + 'repaint, layer and remaster until you select NONE.';
}
