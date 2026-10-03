/**
 * The SCORE verb per song (F-021, F-024): asks the server for the song's SCORE status, starts and
 * polls plan runs, CANCEL, and the APPLY & RENDER seam. Every change goes through the `scoreVerb`
 * reducer. Server-side jobs outlive the tab: reopening SCORE rehydrates from the song's last run.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { api, type ScorePlanRun, type SongDetail } from './api';
import { canPlan, scoreVerb } from './scoreVerb';
import { INITIAL_SCORE, type ScoreEvent, type ScoreVerbState } from './scoreVerbTypes';
import { PLAN_EXPIRED, SERVER_GONE } from './scoreCopy';
import { POLL_MS } from './transcribeStore';

/** Failed polls in a row before the dock stops waiting on a server that is gone. */
const MAX_POLL_STRIKES = 5;

interface ScoreStore {
  bySong: Record<string, ScoreVerbState>;
  dispatch: (songId: string, event: ScoreEvent) => void;
  /** Status, then whatever plan run or plan the server still has (on open, on a song change). */
  load: (songId: string) => Promise<void>;
  /** RECHECK: ask for the status again. */
  recheck: (songId: string) => Promise<void>;
  plan: (songId: string) => Promise<void>;
  cancel: (songId: string) => Promise<void>;
  /** APPLY & RENDER. W3 checks the plan is still the server's (D-020); W4 starts the render. */
  apply: (songId: string) => Promise<void>;
}

const polling = new Set<string>();
const failedRun = (reason: string): ScorePlanRun =>
  ({ jobId: '', request: '', status: 'failed', reasons: [reason], planId: null, cause: 'check' });
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useScoreStore = create<ScoreStore>((set, get) => {
  const state = (songId: string) => get().bySong[songId] ?? INITIAL_SCORE;
  const waiting = (songId: string) => ['queued', 'planning'].includes(state(songId).phase.kind);

  async function poll(songId: string): Promise<void> {
    if (polling.has(songId)) return;
    polling.add(songId);
    let strikes = 0;
    try {
      while (waiting(songId)) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          const { run, plan } = await api.scorePlanState(songId);
          strikes = 0;
          get().dispatch(songId, { type: 'run', run: run ?? failedRun(PLAN_EXPIRED), plan });
        } catch {
          if (++strikes >= MAX_POLL_STRIKES) get().dispatch(songId, { type: 'run', run: failedRun(SERVER_GONE), plan: null });
        }
      }
    } finally {
      polling.delete(songId);
    }
  }

  async function status(songId: string): Promise<boolean> {
    try {
      get().dispatch(songId, { type: 'status', status: await api.scoreStatus(songId) });
      return true;
    } catch {
      return false; // no answer: SCORE stays as it was (hidden on first load)
    }
  }

  return {
    bySong: {},
    dispatch: (songId, event) => set((s) => ({ bySong: { ...s.bySong, [songId]: scoreVerb(s.bySong[songId] ?? INITIAL_SCORE, event) } })),

    load: async (songId) => {
      if (!(await status(songId)) || state(songId).phase.kind !== 'asking') return;
      try {
        const { run, plan } = await api.scorePlanState(songId);
        get().dispatch(songId, { type: 'restore', run, plan });
        void poll(songId);
      } catch {
        // nothing to restore
      }
    },

    recheck: async (songId) => { await status(songId); },

    plan: async (songId) => {
      const s = state(songId);
      if (!canPlan(s)) return;
      try {
        const { queuePosition } = await api.startScorePlan(songId, s.request.trim());
        get().dispatch(songId, { type: 'planSubmitted', ahead: queuePosition });
        void poll(songId);
      } catch (err) {
        get().dispatch(songId, { type: 'planRefused', error: message(err) });
      }
    },

    cancel: async (songId) => {
      if (!waiting(songId)) return;
      get().dispatch(songId, { type: 'cancel' });
      await api.cancelScorePlan(songId).catch(() => undefined); // already settled: the poll says how
    },

    apply: async (songId) => {
      const s = state(songId);
      if (s.phase.kind !== 'ready' || !s.plan) return;
      try {
        const { plan } = await api.scorePlanState(songId);
        if (plan?.id !== s.plan.id) get().dispatch(songId, { type: 'renderRefused', reason: PLAN_EXPIRED });
      } catch (err) {
        get().dispatch(songId, { type: 'renderRefused', reason: message(err) });
      }
    },
  };
});

/** Changes whenever a layer or a version is added, removed or activated: SCORE re-evaluates then. */
export function scoreSongKey(song: SongDetail | null | undefined): string {
  return song?.layers.map((l) => `${l.id}:${l.versions.map((v) => `${v.id}${v.active ? '*' : ''}`).join(',')}`).join('|') ?? '';
}

/** The song's SCORE state, (re)loaded whenever `songKey` says the song changed ('' = not loaded yet). */
export function useScoreVerb(songId: string, songKey: string): ScoreVerbState {
  const load = useScoreStore((s) => s.load);
  useEffect(() => { if (songKey) void load(songId); }, [load, songId, songKey]);
  return useScoreStore((s) => s.bySong[songId] ?? INITIAL_SCORE);
}
