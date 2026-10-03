import { create } from 'zustand';
import { api, ApiError, type StemResult } from './api';
import { useRemasterResult } from './remasterResult';
import { isEditorBusy, type SingleEditorJob, type SplitJobState } from './editorJob';
import { JOB_GONE } from './jobGone';

export { isEditorBusy, myEditorJob } from './editorJob';

interface EditorJobState {
  editorJob: SingleEditorJob | null;
  /** The open split session, if any. Its own slot, because it outlives its lock: once the
   * stems settle the server is free, but the stems stay up for REPLACE/ADD LAYER. */
  splitJob: SplitJobState | null;
  dismiss: () => void;
  startRepaint: (layerId: string, songId: string, params: { prompt: string; start: number; end: number } & Record<string, unknown>) => Promise<void>;
  startRegenerate: (layerId: string, songId: string, versionId: string) => Promise<void>;
  startRetake: (layerId: string, songId: string, versionId: string) => Promise<void>;
  startAddLayer: (songId: string, mixAudio: Blob, params: { prompt: string; layerName: string } & Record<string, unknown>) => Promise<void>;
  startRemaster: (songId: string, mixAudio: Blob, model: string, opts: { audioFormat: string; steps: number }) => Promise<void>;
  startSplit: (layerId: string, songId: string, model: 'acestep' | 'demucs') => Promise<void>;
  /** Abandons the current split session (CANCEL SPLIT) — releases the split slot and
   * tells the server to stop tracking it, same semantics as the old component-local flow. */
  cancelSplit: () => Promise<void>;
  /** Merges a fresh stem (e.g. after RE-EXTRACT or a claim) into the split session in
   * the store, so DockSplit doesn't need its own copy of `stems` to stay in sync. */
  patchSplitStem: (stem: StemResult) => void;
}

const POLL_MS = 2000;
const DONE_LINGER_MS = 1500;

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Shared shape for the five single-`jobId` kinds (split tracks 4 stems instead). `submit`
 * starts the ACE-Step job; `onDone` runs once, right as the job settles successfully
 * (remaster uses it to capture its one-shot result — see remasterResult.ts). */
type Setter = (partial: Partial<EditorJobState> | ((s: EditorJobState) => Partial<EditorJobState>)) => void;

async function runSingleJob(
  set: Setter,
  get: () => EditorJobState,
  provisional: SingleEditorJob,
  submit: () => Promise<{ jobId: string }>,
  onDone?: (job: SingleEditorJob) => void,
): Promise<void> {
  // One editor job at a time — mirrors the server's genLock. A failed one is just replaced.
  if (isEditorBusy(get().editorJob) || selectSplitRunning(get())) return;
  set({ editorJob: provisional });
  let jobId: string;
  try {
    ({ jobId } = await submit());
  } catch (err) {
    set((s) => (s.editorJob === provisional ? { editorJob: { ...provisional, stage: 'failed', error: errMsg(err) } } : {}));
    return;
  }
  const job = { ...provisional, jobId };
  set((s) => (s.editorJob === provisional ? { editorJob: job } : {}));

  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (get().editorJob?.jobId !== jobId) return; // superseded/cleared/cancelled between polls
    let status: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      status = await api.jobStatus(jobId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) continue;
      status = { status: 'failed', error: JOB_GONE };
    }
    if (status.status === 'loading' || status.status === 'running') {
      set((s) => (s.editorJob?.jobId === jobId ? { editorJob: { ...s.editorJob, progress: status.progress, progressStage: status.progressStage, progressText: status.progressText } } : {}));
      continue;
    }
    if (status.status === 'done') {
      const doneJob = { ...job, stage: 'done' as const };
      set((s) => (s.editorJob?.jobId === jobId ? { editorJob: doneJob } : {}));
      onDone?.(doneJob);
      setTimeout(() => set((s) => (s.editorJob?.jobId === jobId && s.editorJob.stage === 'done' ? { editorJob: null } : {})), DONE_LINGER_MS);
    } else {
      set((s) => (s.editorJob?.jobId === jobId ? { editorJob: { ...job, stage: 'failed', error: status.error ?? 'failed' } } : {}));
    }
    return;
  }
}

export const useEditorJobStore = create<EditorJobState>((set, get) => ({
  editorJob: null,
  splitJob: null,
  dismiss: () => set({ editorJob: null }),

  startRepaint: (layerId, songId, params) => runSingleJob(
    set, get, { kind: 'repaint', jobId: '', songId, layerId, startedAt: Date.now(), stage: 'running' },
    () => api.repaint(layerId, params),
  ),

  startRegenerate: (layerId, songId, versionId) => runSingleJob(
    set, get, { kind: 'regenerate', jobId: '', songId, layerId, versionId, startedAt: Date.now(), stage: 'running' },
    () => api.regenerateVersion(versionId),
  ),

  startRetake: (layerId, songId, versionId) => runSingleJob(
    set, get, { kind: 'retake', jobId: '', songId, layerId, versionId, startedAt: Date.now(), stage: 'running' },
    () => api.retakeVersion(versionId),
  ),

  startAddLayer: (songId, mixAudio, params) => runSingleJob(
    set, get, { kind: 'addLayer', jobId: '', songId, startedAt: Date.now(), stage: 'running' },
    () => api.addLayer(songId, mixAudio, params),
  ),

  startRemaster: (songId, mixAudio, model, opts) => {
    useRemasterResult.getState().clear(); // a new run discards the held result
    return runSingleJob(
      set, get, { kind: 'remaster', jobId: '', songId, startedAt: Date.now(), stage: 'running' },
      () => api.remaster(songId, mixAudio, model, opts),
      (job) => void useRemasterResult.getState()
        .capture(songId, job.jobId, `remaster.${opts.audioFormat}`)
        .catch((err) => set((s) => (s.editorJob?.jobId === job.jobId
          ? { editorJob: { ...job, stage: 'failed', error: `remaster finished but couldn't be fetched — ${errMsg(err)}` } }
          : {}))),
    );
  },

  startSplit: async (layerId, songId, model) => {
    const prev = get().splitJob;
    if (isEditorBusy(get().editorJob) || selectSplitRunning(get())) return;
    const stems: StemResult[] = (['vocals', 'drums', 'bass', 'other'] as const).map((kind) => ({ kind, status: 'running' }));
    const provisional: SplitJobState = { kind: 'split', jobId: '', songId, layerId, splitJobId: '', stems, startedAt: Date.now(), stage: 'running' };
    set({ splitJob: provisional });
    // A settled session (DockSplit said so first) is closed on the server; a failed one never started there.
    if (prev?.splitJobId) void api.cancelSplit(prev.splitJobId).catch(() => {});
    let splitJobId: string;
    try {
      ({ jobId: splitJobId } = await api.startSplit(layerId, model));
    } catch (err) {
      set((s) => (s.splitJob === provisional ? { splitJob: { ...provisional, stage: 'failed', error: errMsg(err) } } : {}));
      return;
    }
    const job: SplitJobState = { ...provisional, jobId: splitJobId, splitJobId };
    set((s) => (s.splitJob === provisional ? { splitJob: job } : {}));
    const isThis = (s: EditorJobState) => s.splitJob?.splitJobId === splitJobId;

    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!isThis(get())) return; // cancelled/superseded
      let result: Awaited<ReturnType<typeof api.splitStatus>>;
      try {
        result = await api.splitStatus(splitJobId);
      } catch (err) {
        // 404 = the job was force-stopped elsewhere (header's ABORT pill, or another
        // tab) — stemSplit.ts's cancelSplit deletes it outright, so unlike other job
        // kinds there's no "aborted" status to poll for. Any other error is transient.
        if (err instanceof ApiError && err.status === 404) {
          set((s) => (isThis(s) ? { splitJob: null } : {}));
          return;
        }
        continue;
      }
      set((s) => (isThis(s) && s.splitJob
        ? { splitJob: { ...s.splitJob, stems: result.stems, stage: result.status === 'done' ? 'done' : 'running' } }
        : {}));
      // Keeps polling indefinitely (not just until the first "done") so a later RE-EXTRACT — which
      // flips one stem back to 'running' server-side — is picked up too. The session only ends via
      // cancelSplit() or a new split, either of which makes the guard above return on the next tick.
    }
  },

  cancelSplit: async () => {
    const job = get().splitJob;
    if (!job) return;
    set({ splitJob: null });
    if (job.splitJobId) await api.cancelSplit(job.splitJobId).catch(() => {});
  },

  patchSplitStem: (stem) => set((s) => (s.splitJob
    ? { splitJob: { ...s.splitJob, stems: s.splitJob.stems.map((x) => (x.kind === stem.kind ? stem : x)) } }
    : {})),
}));

/** Whether a split holds the server's lock: its first pass, or a RE-EXTRACT, is still running.
 * A settled split session blocks nothing — see PLAN.md "A Settled Split Blocks Nothing". */
export const selectSplitRunning = (s: Pick<EditorJobState, 'splitJob'>): boolean => s.splitJob?.stage === 'running';
