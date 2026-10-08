/**
 * The SCORE verb per song (F-021, F-023, F-024): asks the server for the song's SCORE status, starts
 * and polls plan runs and renders, and CANCELs either. Every change goes through the `scoreVerb`
 * reducer. Server-side jobs outlive the tab: reopening SCORE rehydrates from the song's last run.
 */
import { create } from 'zustand';
import { api, type ScorePlanPress, type ScorePlanRun } from './api';
import { canPlan, canRender, canRevise, scoreVerb } from './scoreVerb';
import { planReferent, reviseReferent } from './scoreReferent';
import { INITIAL_SCORE, type ScoreEvent, type ScoreVerbState } from './scoreVerbTypes';
import { PLAN_EXPIRED, SERVER_GONE } from './scoreCopy';
import { followRender, renderEvent, renderInFlight } from './scoreRender';
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
  /** PLAN from the song, with the pick pinned (F-032, M2-3). */
  plan: (songId: string) => Promise<void>;
  /** RE-TIME (RT-4): a plan from the kept reading, under review at once; a refusal is the dock's error line. */
  retime: (songId: string, mode: 'half' | 'double' | 'bpm', bpm: number | null) => Promise<void>;
  /** REVISE the plan under review (F-033): its referent goes again unless the pick changed (D-070 c). */
  revise: (songId: string) => Promise<void>;
  cancel: (songId: string) => Promise<void>;
  /** APPLY & RENDER (and RETRY RENDER): the server re-checks and queues the render, or names why not. */
  apply: (songId: string) => Promise<void>;
}

const polling = new Set<string>();
const following = new Set<string>();
const failedRun = (reason: string): ScorePlanRun =>
  ({ jobId: '', request: '', status: 'failed', reasons: [reason], planId: null, cause: 'check' });
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useScoreStore = create<ScoreStore>((set, get) => {
  const state = (songId: string) => get().bySong[songId] ?? INITIAL_SCORE;
  const waiting = (songId: string) => ['queued', 'planning'].includes(state(songId).phase.kind);
  const rendering = (songId: string) => ['renderQueued', 'rendering'].includes(state(songId).phase.kind);

  async function follow(songId: string): Promise<void> {
    if (following.has(songId)) return;
    following.add(songId);
    try {
      await followRender(songId, (e) => get().dispatch(songId, e), () => rendering(songId));
    } finally {
      following.delete(songId);
    }
  }

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

  /** POST the plan: queued (poll it), a stale pick (nothing queued), or refused. */
  async function press(songId: string, request: string, opts: ScorePlanPress): Promise<void> {
    try {
      const started = await api.startScorePlan(songId, request, opts);
      if ('stale' in started) return get().dispatch(songId, { type: 'planStale', stale: started.stale });
      get().dispatch(songId, { type: 'planSubmitted', ahead: started.queuePosition, revise: !!opts.revise });
      void poll(songId);
    } catch (err) {
      get().dispatch(songId, { type: 'planRefused', error: message(err) });
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
        const render = state(songId).phase.kind === 'ready' ? await renderInFlight(songId) : null;
        if (!render || render.planId !== plan?.id) return;
        get().dispatch(songId, { type: 'renderSubmitted', ahead: render.queuePosition ?? 0 });
        get().dispatch(songId, renderEvent(render));
        void follow(songId);
      } catch {
        // nothing to restore
      }
    },

    recheck: async (songId) => { await status(songId); },

    retime: async (songId, mode, bpm) => {
      try {
        get().dispatch(songId, { type: 'retimed', plan: await api.startScoreRetime(songId, mode, bpm) });
      } catch (err) {
        get().dispatch(songId, { type: 'planRefused', error: message(err) });
      }
    },

    plan: async (songId) => {
      const s = state(songId);
      if (canPlan(s)) await press(songId, s.request.trim(), { referent: planReferent(s) });
    },

    revise: async (songId) => {
      const s = state(songId);
      if (canRevise(s) && s.plan) await press(songId, s.request.trim(), { referent: reviseReferent(s), revise: s.plan.id });
    },

    cancel: async (songId) => {
      if (rendering(songId)) {
        // ABORT: YuE2 drains while the slot stays held; no version is made, the plan stays.
        const ok = await api.cancelScoreRender(songId).then(() => true, () => false);
        if (ok) get().dispatch(songId, { type: 'renderCancelled' }); // else it already settled: the poll says how
        return;
      }
      if (!waiting(songId)) return;
      get().dispatch(songId, { type: 'cancel' });
      await api.cancelScorePlan(songId).catch(() => undefined); // already settled: the poll says how
    },

    apply: async (songId) => {
      const s = state(songId);
      if (!canRender(s) || !s.plan) return;
      try {
        const started = await api.startScoreRender(songId, s.plan.id);
        if ('refused' in started) return get().dispatch(songId, { type: 'renderRefused', reason: started.refused });
        get().dispatch(songId, { type: 'renderSubmitted', ahead: started.queuePosition });
        void follow(songId);
      } catch (err) {
        get().dispatch(songId, { type: 'planRefused', error: message(err) }); // queue full, already rendering
      }
    },
  };
});
