/**
 * generationStore's poll loop: follows one song-generation job until it settles, or until
 * the store stops tracking it (dismissed). Each job in the store has its own loop.
 */
import { api, ApiError } from './api';
import { JOB_GONE } from './jobGone';
import type { GenerationJob, GenStage } from './generationStore';

type JobsSlice = { jobs: GenerationJob[] };
type SetState = (fn: (s: JobsSlice) => Partial<JobsSlice>) => void;
type GetState = () => JobsSlice;

const POLL_MS = 2000;
/** How long the shrunk "done" card lingers before it's cleared, giving the shrink
 * transition somewhere to land before the real song row (from the library refresh)
 * takes its place. */
const DONE_LINGER_MS = 900;

/** Job ids with a live poll loop: hydrate() runs twice on mount under StrictMode, and both
 * (or refreshLock) can adopt the same running job — one loop per job is enough. */
const polling = new Set<string>();

export function pollJob(jobId: string, set: SetState, get: GetState): void {
  if (polling.has(jobId)) return;
  polling.add(jobId);
  void pollUntilSettled(jobId, set, get).finally(() => polling.delete(jobId));
}

async function pollUntilSettled(jobId: string, set: SetState, get: GetState) {
  /** Applies `fn` to this job, or drops it on null; a no-op once the store no longer has it. */
  const update = (fn: (job: GenerationJob) => GenerationJob | null) => set((s) => {
    const job = s.jobs.find((j) => j.jobId === jobId);
    if (!job) return {};
    const next = fn(job);
    return { jobs: next ? s.jobs.map((j) => (j === job ? next : j)) : s.jobs.filter((j) => j !== job) };
  });
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!get().jobs.some((j) => j.jobId === jobId)) return; // dismissed between polls
    let s: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      s = await api.jobStatus(jobId);
    } catch (err) {
      // A network hiccup keeps polling rather than surfacing a false failure; a 404 never recovers.
      if (!(err instanceof ApiError && err.status === 404)) continue;
      s = { status: 'failed', error: JOB_GONE };
    }
    if (s.status === 'queued') {
      // Waiting behind another job: the card stays "loading", now saying where it is in line.
      update((j) => ({ ...j, stage: 'loading', queuePosition: s.queuePosition ?? 1 }));
      continue;
    }
    if (s.status === 'loading' || s.status === 'running') {
      update((j) => ({ ...j, stage: s.status as GenStage, queuePosition: undefined, progress: s.progress, progressStage: s.progressStage, progressText: s.progressText }));
      continue;
    }
    if (s.cancelled) {
      // CANCEL on its UP NEXT row (or its song was trashed): gone, not failed — nothing to retry.
      update(() => null);
      return;
    }
    if (s.status === 'done') {
      update((j) => ({ ...j, stage: 'done', queuePosition: undefined, songId: s.songId }));
      setTimeout(() => update((j) => (j.stage === 'done' ? null : j)), DONE_LINGER_MS);
      return;
    }
    update((j) => ({ ...j, stage: 'failed', queuePosition: undefined, error: s.error ?? 'generation failed' }));
    return;
  }
}
