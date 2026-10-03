import { create } from 'zustand';
import { api, ApiError, type StemResult } from './api';
import { useRemasterResult } from './remasterResult';
import type { SingleEditorJob, SplitJobState } from './editorJob';
import { POLL_MS, errMsg, newJobKey, runSingleJob } from './editorSingleJob';

export { isEditorBusy, myEditorJobs, jobView } from './editorJob';
export { selectSplitRunning } from './editorSingleJob';

/** Each start resolves with the new job's key once its submit has answered. */
type Start<A extends unknown[]> = (...args: A) => Promise<string>;

interface EditorJobState {
  /** Every editor job this tab follows, oldest first: several can wait in the server's queue
   * at once (PLAN.md "UI Redesign", S4.7). Done ones linger briefly; failed ones stay until
   * dismissed or retried. */
  editorJobs: SingleEditorJob[];
  /** The open split session, if any. Its own slot, because it outlives its job: once the
   * stems settle the server is free, but the stems stay up for REPLACE/ADD LAYER. */
  splitJob: SplitJobState | null;
  dismiss: (key: string) => void;
  startRepaint: Start<[layerId: string, songId: string, params: { prompt: string; start: number; end: number } & Record<string, unknown>]>;
  startRegenerate: Start<[layerId: string, songId: string, versionId: string]>;
  startRetake: Start<[layerId: string, songId: string, versionId: string]>;
  startAddLayer: Start<[songId: string, mixAudio: Blob, params: { prompt: string; layerName: string } & Record<string, unknown>]>;
  startRemaster: Start<[songId: string, mixAudio: Blob, model: string, opts: { audioFormat: string; steps: number }]>;
  startSplit: (layerId: string, songId: string, model: 'acestep' | 'demucs') => Promise<void>;
  /** Abandons the current split session (CANCEL SPLIT) — releases the split slot and
   * tells the server to stop tracking it, same semantics as the old component-local flow. */
  cancelSplit: () => Promise<void>;
  /** Merges a fresh stem (e.g. after RE-EXTRACT or a claim) into the split session in
   * the store, so DockSplit doesn't need its own copy of `stems` to stay in sync. */
  patchSplitStem: (stem: StemResult) => void;
}

export const useEditorJobStore = create<EditorJobState>((set, get) => ({
  editorJobs: [],
  splitJob: null,
  dismiss: (key) => set((s) => ({ editorJobs: s.editorJobs.filter((j) => j.key !== key) })),

  startRepaint: (layerId, songId, params) => runSingleJob(
    set, get, {
      kind: 'repaint', jobId: '', songId, layerId, startedAt: Date.now(), stage: 'running',
      submitted: { prompt: params.prompt, start: params.start, end: params.end },
    },
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
    set, get, {
      kind: 'addLayer', jobId: '', songId, startedAt: Date.now(), stage: 'running',
      submitted: { prompt: params.prompt, trackName: String(params.track_name ?? ''), lyrics: String(params.lyrics ?? '') },
    },
    () => api.addLayer(songId, mixAudio, params),
  ),

  startRemaster: (songId, mixAudio, model, opts) => {
    useRemasterResult.getState().clear(); // a new run discards the held result
    return runSingleJob(
      set, get, { kind: 'remaster', jobId: '', songId, startedAt: Date.now(), stage: 'running' },
      () => api.remaster(songId, mixAudio, model, opts),
      (job) => void useRemasterResult.getState()
        .capture(songId, job.jobId, `remaster.${opts.audioFormat}`)
        .catch((err) => set((s) => ({
          editorJobs: s.editorJobs.map((j) => (j.key === job.key
            ? { ...j, stage: 'failed', error: `remaster finished but couldn't be fetched — ${errMsg(err)}` } : j)),
        }))),
    );
  },

  startSplit: async (layerId, songId, model) => {
    const prev = get().splitJob;
    const stems: StemResult[] = (['vocals', 'drums', 'bass', 'other'] as const).map((kind) => ({ kind, status: 'running' }));
    const provisional: SplitJobState = {
      kind: 'split', key: newJobKey('split'), jobId: '', songId, layerId, splitJobId: '', stems, startedAt: Date.now(), stage: 'running',
      retry: () => {
        // Another layer's session would be closed by a new start, so RETRY only replaces its own.
        const open = get().splitJob;
        if (open && open.stage !== 'failed' && open.layerId !== layerId) return false;
        void get().startSplit(layerId, songId, model);
        return true;
      },
    };
    set({ splitJob: provisional });
    // The session it replaces is closed on the server (DockSplit said so first); a failed one never started there.
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
        // 404 = the job was force-stopped or cancelled elsewhere (ABORT, CANCEL on its UP
        // NEXT row, or another tab) — stemSplit.ts drops it outright, so unlike other job
        // kinds there's no "aborted" status to poll for. Any other error is transient.
        if (err instanceof ApiError && err.status === 404) {
          set((s) => (isThis(s) ? { splitJob: null } : {}));
          return;
        }
        continue;
      }
      // A queued split keeps its `running` stage (its stems read running) with queuePosition set.
      set((s) => (isThis(s) && s.splitJob
        ? { splitJob: { ...s.splitJob, stems: result.stems, stage: result.status === 'done' ? 'done' : 'running', queuePosition: result.queuePosition } }
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
