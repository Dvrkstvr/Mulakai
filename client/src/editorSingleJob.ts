/** editorJobStore's poll loop for the five single-`jobId` kinds (split tracks 4 stems instead):
 * submit, then follow the job through the server's queue to done or failed. */
import { api, ApiError } from './api';
import { isEditorBusy, type SingleEditorJob, type SplitJobState } from './editorJob';
import { JOB_GONE } from './jobGone';

export interface EditorSlots {
  editorJob: SingleEditorJob | null;
  splitJob: SplitJobState | null;
}

type Setter = (fn: (s: EditorSlots) => Partial<EditorSlots>) => void;

export const POLL_MS = 2000;
const DONE_LINGER_MS = 1500;

export const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Whether a split holds the server's slot: its first pass, or a RE-EXTRACT, is still running.
 * A settled split session blocks nothing — see PLAN.md "A Settled Split Blocks Nothing". */
export const selectSplitRunning = (s: Pick<EditorSlots, 'splitJob'>): boolean => s.splitJob?.stage === 'running';

/** Whether this tab already follows an editor job: one runs or waits, or a split is extracting. */
export const slotBusy = (s: EditorSlots): boolean => isEditorBusy(s.editorJob) || selectSplitRunning(s);

/** `submit` starts the job; `onDone` runs once, right as it settles successfully (remaster uses
 * it to capture its one-shot result — see remasterResult.ts). A job waiting in the server's
 * queue keeps its `running` stage with `queuePosition` set; a cancelled one simply leaves. */
export async function runSingleJob(
  set: Setter,
  get: () => EditorSlots,
  base: SingleEditorJob,
  submit: () => Promise<{ jobId: string }>,
  onDone?: (job: SingleEditorJob) => void,
): Promise<void> {
  // One editor job per tab — the store follows one at a time. A failed one is just replaced.
  if (slotBusy(get())) return;
  const provisional: SingleEditorJob = {
    ...base,
    retry: () => {
      if (slotBusy(get())) return false;
      void runSingleJob(set, get, { ...base, startedAt: Date.now() }, submit, onDone);
      return true;
    },
  };
  set(() => ({ editorJob: provisional }));
  let jobId: string;
  try {
    ({ jobId } = await submit());
  } catch (err) {
    set((s) => (s.editorJob === provisional ? { editorJob: { ...provisional, stage: 'failed', error: errMsg(err) } } : {}));
    return;
  }
  const job = { ...provisional, jobId };
  set((s) => (s.editorJob === provisional ? { editorJob: job } : {}));
  const mine = (s: EditorSlots) => s.editorJob?.jobId === jobId;

  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!mine(get())) return; // superseded/cleared/cancelled between polls
    let status: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      status = await api.jobStatus(jobId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) continue;
      status = { status: 'failed', error: JOB_GONE };
    }
    if (status.status === 'queued') {
      set((s) => (mine(s) && s.editorJob ? { editorJob: { ...s.editorJob, queuePosition: status.queuePosition ?? 1 } } : {}));
      continue;
    }
    if (status.status === 'loading' || status.status === 'running') {
      set((s) => (mine(s) && s.editorJob ? { editorJob: { ...s.editorJob, queuePosition: undefined, progress: status.progress, progressStage: status.progressStage, progressText: status.progressText } } : {}));
      continue;
    }
    if (status.status === 'done') {
      const doneJob = { ...job, stage: 'done' as const };
      set((s) => (mine(s) ? { editorJob: doneJob } : {}));
      onDone?.(doneJob);
      setTimeout(() => set((s) => (mine(s) && s.editorJob?.stage === 'done' ? { editorJob: null } : {})), DONE_LINGER_MS);
    } else if (status.cancelled) {
      set((s) => (mine(s) ? { editorJob: null } : {})); // CANCEL on its UP NEXT row: gone, nothing to retry
    } else {
      set((s) => (mine(s) ? { editorJob: { ...job, stage: 'failed', error: status.error ?? 'failed' } } : {}));
    }
    return;
  }
}
