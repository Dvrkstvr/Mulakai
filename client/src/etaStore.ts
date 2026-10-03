import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGenerationStore } from './generationStore';

/** Create's "Takes about" row (PLAN.md "S2 — Guided Create", point 5): a rolling mean of real
 * waits, never an invented number, so the row stays hidden until one sample exists. */
export const ETA_SAMPLES = 5;

export interface EtaKeyParts {
  task: 'text2music' | 'cover' | 'complete';
  engine: string;
  /** Model family and QUALITY decide steps on ACE-Step; an extra engine has neither ('na'). */
  family: string;
  quality: string;
}

export const etaKey = (p: EtaKeyParts): string => `${p.task}|${p.engine}|${p.family}|${p.quality}`;

export function addSample(list: number[] | undefined, ms: number): number[] {
  return [...(list ?? []), ms].slice(-ETA_SAMPLES);
}

export function meanMs(list: number[] | undefined): number | null {
  if (!list?.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

/** "45 s" under a minute and a half, whole minutes past it. */
export function formatEta(ms: number): string {
  const s = ms / 1000;
  if (s < 90) return `${Math.max(5, Math.round(s / 5) * 5)} s`;
  return `${Math.round(s / 60)} min`;
}

interface EtaState {
  samples: Record<string, number[]>;
  /** The generation just submitted from Create, matched to the store's job by its startedAt. */
  pending: { key: string; startedAt: number } | null;
  expect: (key: string, startedAt: number) => void;
  settle: (startedAt: number, doneAt: number | null) => void;
}

export const useEtaStore = create<EtaState>()(
  persist(
    (set, get) => ({
      samples: {},
      pending: null,
      expect: (key, startedAt) => set({ pending: { key, startedAt } }),
      settle: (startedAt, doneAt) => {
        const pending = get().pending;
        if (!pending || pending.startedAt !== startedAt) return;
        if (doneAt === null) { set({ pending: null }); return; } // a failed job is no sample
        const samples = { ...get().samples, [pending.key]: addSample(get().samples[pending.key], doneAt - startedAt) };
        set({ samples, pending: null });
      },
    }),
    { name: 'mulakai-eta', partialize: (s) => ({ samples: s.samples }) },
  ),
);

/** The mean wait for `key`, or null with no samples yet. */
export const useEta = (key: string): number | null => useEtaStore((s) => meanMs(s.samples[key]));

// A generation settles in the Library, long after Create unmounted, so the watch lives here.
useGenerationStore.subscribe((s, prev) => {
  if (s.jobs === prev.jobs) return;
  for (const job of s.jobs) {
    if (job.stage === prev.jobs.find((j) => j.key === job.key)?.stage) continue;
    if (job.stage === 'done') useEtaStore.getState().settle(job.startedAt, Date.now());
    else if (job.stage === 'failed') useEtaStore.getState().settle(job.startedAt, null);
  }
});
