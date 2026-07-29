import { create } from 'zustand';
import { api } from './api';
import { previewPlayback } from './previewPlayback';
import { evictPeaks } from './waveformPeaks';

/** A finished remaster, fetched client-side the moment the job settles — the server
 * streams the file exactly once then deletes it (routes/remaster.ts), so this blob is
 * the only copy. Audition + DOWNLOAD both use the object URL; the next run clears it. */
export interface RemasterResult {
  songId: string;
  url: string;
  filename: string;
}

interface RemasterResultState {
  result: RemasterResult | null;
  /** Fetch the one-shot download into a blob and hold it. Throws on fetch failure —
   * there is nothing to retry against afterwards, the caller surfaces the error. */
  capture: (songId: string, jobId: string, filename: string) => Promise<void>;
  /** Discard the held result: stop it if it's the live preview, drop its cached
   * peaks, release the blob. */
  clear: () => void;
}

export const useRemasterResult = create<RemasterResultState>((set, get) => ({
  result: null,
  capture: async (songId, jobId, filename) => {
    const res = await fetch(api.remasterDownloadUrl(songId, jobId));
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const blob = await res.blob();
    get().clear();
    set({ result: { songId, url: URL.createObjectURL(blob), filename } });
  },
  clear: () => {
    const r = get().result;
    if (!r) return;
    if (previewPlayback.getState().key === r.url) previewPlayback.stop();
    evictPeaks(r.url);
    URL.revokeObjectURL(r.url);
    set({ result: null });
  },
}));
