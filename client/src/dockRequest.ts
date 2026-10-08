import { create } from 'zustand';

export type ExportWhat = 'mix' | 'stems' | 'remaster' | 'midi';

/**
 * A pick for a dock verb's body made from outside it (the Ctrl K palette's "Add layer ·
 * strings", "Export stems"). The body applies it when it next renders and clears it, so a
 * request never lingers into another song. Targets only; nothing here commits a job.
 */
interface DockRequest {
  track: string | null;
  exportWhat: ExportWhat | null;
  pickTrack: (track: string) => void;
  pickExport: (what: ExportWhat) => void;
}

export const useDockRequest = create<DockRequest>((set) => ({
  track: null,
  exportWhat: null,
  pickTrack: (track) => set({ track }),
  pickExport: (exportWhat) => set({ exportWhat }),
}));
