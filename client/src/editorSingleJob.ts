/** editorJobStore's poll loop for the five single-`jobId` kinds (split tracks 4 stems instead):
 * submit, then follow the job through the server's queue to done or failed. Several can be in
 * flight at once; each is found by its `key` (PLAN.md "UI Redesign", S4.7). */
import { api, ApiError } from './api';
import type { SingleEditorJob, SplitJobState } from './editorJob';
import { JOB_GONE } from './jobGone';
import { useQueueStore } from './queueStore';

export interface EditorSlots {
  editorJobs: SingleEditorJob[];
  splitJob: SplitJobState | null;
}

type Setter = (fn: (s: EditorSlots) => Partial<EditorSlots>) => void;
/** A job as its start function describes it, before it has a key. */
export type NewEditorJob = SingleEditorJob extends infer J ? (J extends SingleEditorJob ? Omit<J, 'key'> : never) : never;

export const POLL_MS = 2000;
const DONE_LINGER_MS = 1500;

export const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Whether a split is extracting: its first pass, or a RE-EXTRACT, is still running. A settled
 * split session blocks nothing — see PLAN.md "A Settled Split Blocks Nothing". */
export const selectSplitRunning = (s: Pick<EditorSlots, 'splitJob'>): boolean => s.splitJob?.stage === 'running';

let seq = 0;
export const newJobKey = (kind: string): string => `${kind}-${Date.now().toString(36)}-${(seq += 1)}`;

/** Replaces (or, with null, drops) the job under `key`; a no-op once it is gone. */
function patcher(set: Setter, key: string) {
  return (fn: (job: SingleEditorJob) => SingleEditorJob | null) => set((s) => {
    const job = s.editorJobs.find((j) => j.key === key);
    if (!job) return {};
    const next = fn(job);
    return { editorJobs: next ? s.editorJobs.map((j) => (j.key === key ? next : j)) : s.editorJobs.filter((j) => j.key !== key) };
  });
}

/** `submit` starts the job; `onDone` runs once, right as it settles successfully (remaster uses
 * it to capture its one-shot result — see remasterResult.ts). Resolves with the job's key once
 * the submit has answered (a refused one, e.g. a full queue, is then already `failed`); the job
 * is followed in the background. A queued job keeps its `running` stage with `queuePosition`
 * set; a cancelled one simply leaves. */
export async function runSingleJob(
  set: Setter,
  get: () => EditorSlots,
  base: NewEditorJob,
  submit: () => Promise<{ jobId: string }>,
  onDone?: (job: SingleEditorJob) => void,
): Promise<string> {
  const key = newJobKey(base.kind);
  const patch = patcher(set, key);
  const job = {
    ...base,
    key,
    retry: () => {
      patch(() => null); // the new attempt replaces this failed one
      void runSingleJob(set, get, { ...base, startedAt: Date.now() }, submit, onDone);
      return true;
    },
  } as SingleEditorJob;
  set((s) => ({ editorJobs: [...s.editorJobs, job] }));
  let jobId: string;
  try {
    ({ jobId } = await submit());
  } catch (err) {
    patch((j) => ({ ...j, stage: 'failed', error: errMsg(err) }));
    return key;
  }
  patch((j) => ({ ...j, jobId }));
  void useQueueStore.getState().poll(); // the next commit's "starts after N jobs" counts this one
  void follow(get, patch, key, jobId, onDone);
  return key;
}

async function follow(
  get: () => EditorSlots, patch: ReturnType<typeof patcher>, key: string, jobId: string,
  onDone?: (job: SingleEditorJob) => void,
): Promise<void> {
  const mine = () => get().editorJobs.find((j) => j.key === key);
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!mine()) return; // dismissed or cancelled between polls
    let status: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      status = await api.jobStatus(jobId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) continue;
      status = { status: 'failed', error: JOB_GONE };
    }
    if (status.status === 'queued') {
      patch((j) => ({ ...j, queuePosition: status.queuePosition ?? 1 }));
      continue;
    }
    if (status.status === 'loading' || status.status === 'running') {
      patch((j) => ({ ...j, queuePosition: undefined, progress: status.progress, progressStage: status.progressStage, progressText: status.progressText }));
      continue;
    }
    if (status.status === 'done') {
      patch((j) => ({ ...j, stage: 'done', queuePosition: undefined }));
      const done = mine();
      if (done) onDone?.(done);
      setTimeout(() => patch((j) => (j.stage === 'done' ? null : j)), DONE_LINGER_MS);
    } else if (status.cancelled) {
      patch(() => null); // CANCEL on its UP NEXT row: gone, nothing to retry
    } else {
      patch((j) => ({ ...j, stage: 'failed', queuePosition: undefined, error: status.error ?? 'failed' }));
    }
    return;
  }
}
