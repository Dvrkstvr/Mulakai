import { create } from 'zustand';
import { api, ApiError } from './api';

/**
 * The Editor's automatic word-timing reads (PLAN.md "Editor Word Timestamps", decisions 1
 * and 9). Outside React so a read survives leaving the Editor, like editorJobStore. A
 * failure sticks per version until RETRY, so a broken service can't loop the auto-read.
 */
export interface TimingsRun {
  stage: 'running' | 'done' | 'failed';
  error?: string;
}

interface TimingsState {
  /** null until lyrics-server's health has been asked once. */
  configured: boolean | null;
  runs: Record<string, TimingsRun>;
  checkConfigured: () => Promise<void>;
  /** Starts a read unless one is running for this version. Resolves once it settles. */
  read: (versionId: string) => Promise<void>;
  /** Forgets a failure, so the auto-read tries the version again. */
  retry: (versionId: string) => void;
}

const POLL_MS = 2000;

let healthAsked: Promise<void> | null = null;

export const useTimingsStore = create<TimingsState>((set, get) => {
  const settle = (versionId: string, run: TimingsRun | null) => set((s) => {
    const runs = { ...s.runs };
    if (run) runs[versionId] = run;
    else delete runs[versionId];
    return { runs };
  });

  return {
    configured: null,
    runs: {},

    checkConfigured: () => {
      healthAsked ??= api.lyricsHealth()
        .then(({ configured }) => set({ configured }))
        .catch(() => { healthAsked = null; }); // unreachable server: ask again next time
      return healthAsked;
    },

    read: async (versionId) => {
      if (get().runs[versionId]?.stage === 'running') return;
      settle(versionId, { stage: 'running' });
      let jobId: string;
      try {
        ({ jobId } = await api.readTimings(versionId));
      } catch (err) {
        // Another job took the lock first: not a failure, the auto-read tries again once it frees.
        if (err instanceof ApiError && err.status === 409) return settle(versionId, null);
        return settle(versionId, { stage: 'failed', error: err instanceof Error ? err.message : String(err) });
      }
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        let status: Awaited<ReturnType<typeof api.jobStatus>>;
        try {
          status = await api.jobStatus(jobId);
        } catch (err) {
          // 404: the server restarted and forgot the job; let the auto-read start over.
          if (err instanceof ApiError && err.status === 404) return settle(versionId, null);
          continue;
        }
        if (status.status === 'done') return settle(versionId, { stage: 'done' });
        if (status.status === 'failed') return settle(versionId, { stage: 'failed', error: status.error ?? 'failed' });
      }
    },

    retry: (versionId) => {
      if (get().runs[versionId]?.stage === 'failed') settle(versionId, null);
    },
  };
});

/** When the Editor reads a version on its own: the service is set up, the version is unread
 * and has words to time, nothing ran or failed for it yet, and no job holds the lock. */
export function shouldAutoRead(o: {
  configured: boolean | null; versionId?: string; hasTimings: boolean; hasWords: boolean;
  run?: TimingsRun; lockFree: boolean;
}): boolean {
  return !!o.configured && !!o.versionId && !o.hasTimings && o.hasWords && !o.run && o.lockFree;
}

/** Test hook: forget the cached health answer. */
export function resetTimingsHealth(): void {
  healthAsked = null;
}
