/** Quick Start's "AI thinking" (PLAN.md "Create Bar Mirrors Create"): expanding a library-bar
 * idea into a draft via the LM. It lives here, not in Create, so leaving Create no longer drops
 * it — the job runs on, the Library's create bar shows it, and its result lands in the draft
 * either through Create's reveal (Create is open) or straight away (it isn't). */
import { create } from 'zustand';
import { api, type RefineResult } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { followLmJob } from './lmJob';

type DraftPatch = Parameters<ReturnType<typeof useCreateDraftStore.getState>['patch']>[0];

export type ThinkingPhase = 'idle' | 'thinking' | 'revealing';

interface QuickStartState {
  phase: ThinkingPhase;
  /** The idea being expanded, while thinking. */
  query: string;
  /** Place in the server's queue (1 = next) while waiting; null once it runs. */
  position: number | null;
  error: string;
  /** What the LM wrote, held for Create's reveal. */
  result: RefineResult | null;
  /** Mounted Create screens that will reveal a result (IdeaSteps). */
  hosts: number;
  start: (query: string) => void;
  /** Drops the idea: a queued job leaves the queue, a running one runs out unread. */
  stop: () => void;
  /** Create's reveal finished: the draft has the result. */
  finish: () => void;
  /** IdeaSteps is on screen; returns the release. */
  host: () => () => void;
}

/** The draft fields a result fills, all at once (the reveal types prompt and lyrics instead). */
export function sampleToDraft(r: RefineResult, withText = true): DraftPatch {
  return {
    formatted: true,
    ...(withText ? { prompt: r.caption, lyrics: r.lyrics } : {}),
    ...(r.bpm ? { bpm: r.bpm } : {}),
    ...(r.key_scale ? { keyScale: r.key_scale } : {}),
    ...(r.time_signature ? { timeSignature: r.time_signature } : {}),
    ...(r.vocal_language ? { vocalLanguage: r.vocal_language } : {}),
    ...(r.duration ? { duration: r.duration } : {}),
  };
}

const draft = () => useCreateDraftStore.getState();
let attempt = 0;

export const useQuickStartStore = create<QuickStartState>()((set, get) => {
  const settle = (patch: Partial<QuickStartState>) => set({ phase: 'idle', query: '', position: null, result: null, ...patch });
  const land = (r: RefineResult) => {
    draft().patch(sampleToDraft(r));
    draft().clearPendingQuery();
    settle({});
  };

  return {
    phase: 'idle', query: '', position: null, error: '', result: null, hosts: 0,

    start: (query) => {
      if (get().phase !== 'idle') return;
      const id = ++attempt;
      const current = () => attempt === id;
      set({ phase: 'thinking', query, position: null, error: '', result: null });
      followLmJob(() => api.sampleFromQuery(query), (p) => current() && set({ position: p }), current)
        .then((r) => {
          if (!current()) return;
          if (!r) { draft().clearPendingQuery(); settle({}); return; } // cancelled from UP NEXT
          if (get().hosts > 0) set({ phase: 'revealing', position: null, result: r });
          else land(r);
        })
        .catch((err) => { if (current()) settle({ error: err instanceof Error ? err.message : String(err) }); });
    },

    stop: () => {
      attempt++;
      draft().clearPendingQuery();
      settle({ error: '' });
    },

    finish: () => {
      draft().clearPendingQuery();
      settle({});
    },

    host: () => {
      set((s) => ({ hosts: s.hosts + 1 }));
      return () => {
        set((s) => ({ hosts: s.hosts - 1 }));
        // Leaving mid-reveal: the typewriter stops, so land the whole result at once.
        const { phase, result } = get();
        if (phase === 'revealing' && result && get().hosts === 0) land(result);
      };
    },
  };
});
