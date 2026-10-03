import { create } from 'zustand';
import type { ActivityEntry } from './activitySettle';

export type { ActivityEntry } from './activitySettle';

/** Session-only, newest first. RUNNING isn't stored here: it is read live from the owning
 * stores (activityRunning.ts), so a reload rebuilds it from `/active` alone. */
export const ACTIVITY_CAP = 30;

interface ActivityState {
  entries: ActivityEntry[];
  drawerOpen: boolean;
  record: (entry: ActivityEntry) => void;
  /** Fills in what was read after the fact (a repaint's version badge). */
  patch: (id: string, p: Partial<ActivityEntry>) => void;
  remove: (id: string) => void;
  /** CLEAR DONE: empties DONE and FAILED alike. */
  clear: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  entries: [],
  drawerOpen: false,
  record: (entry) => set((s) => ({ entries: [entry, ...s.entries].slice(0, ACTIVITY_CAP) })),
  patch: (id, p) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
  remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  clear: () => set({ entries: [] }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
}));
