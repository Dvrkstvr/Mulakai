import { create } from 'zustand';
import { api, ApiError, type StemResult } from './api';
import { useRemasterResult } from './remasterResult';

export type Stage = 'running' | 'done' | 'failed';

interface JobBase {
  jobId: string;
  songId: string;
  startedAt: number;
  stage: Stage;
  error?: string;
  progress?: number; // live progress from ACE-Step's /query_result, refreshed each poll tick
  progressStage?: string;
  progressText?: string;
}

export interface RepaintJob extends JobBase { kind: 'repaint'; layerId: string }
export interface RegenerateJob extends JobBase { kind: 'regenerate'; layerId: string; versionId: string }
export interface RetakeJob extends JobBase { kind: 'retake'; layerId: string; versionId: string }
export interface AddLayerJob extends JobBase { kind: 'addLayer' }
export interface RemasterJob extends JobBase { kind: 'remaster' }
export interface SplitJobState extends JobBase { kind: 'split'; layerId: string; splitJobId: string; stems: StemResult[] }

export type EditorJob = RepaintJob | RegenerateJob | RetakeJob | AddLayerJob | RemasterJob | SplitJobState;

/** Selects `editorJob` only if it matches this kind and every id given — lets a
 * component tell "this is my own in-flight job" apart from "something else is
 * running" without each caller re-deriving the comparison. */
export function myEditorJob<K extends EditorJob['kind']>(
  job: EditorJob | null, kind: K, ids: Partial<Record<'songId' | 'layerId' | 'versionId', string>>,
): (EditorJob & { kind: K }) | null {
  if (!job || job.kind !== kind) return null;
  const record = job as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(ids)) {
    if (value !== undefined && record[key] !== value) return null;
  }
  return job as EditorJob & { kind: K };
}

interface EditorJobState {
  editorJob: EditorJob | null;
  dismiss: () => void;
  startRepaint: (layerId: string, songId: string, params: { prompt: string; start: number; end: number } & Record<string, unknown>) => Promise<void>;
  startRegenerate: (layerId: string, songId: string, versionId: string) => Promise<void>;
  startRetake: (layerId: string, songId: string, versionId: string) => Promise<void>;
  startAddLayer: (songId: string, mixAudio: Blob, params: { prompt: string; layerName: string } & Record<string, unknown>) => Promise<void>;
  startRemaster: (songId: string, mixAudio: Blob, model: string, opts: { audioFormat: string; steps: number }) => Promise<void>;
  startSplit: (layerId: string, songId: string, model: 'acestep' | 'demucs') => Promise<void>;
  /** Abandons the current split session (CANCEL SPLIT) — releases the store slot and
   * tells the server to stop tracking it, same semantics as the old component-local flow. */
  cancelSplit: () => Promise<void>;
  /** Merges a fresh stem (e.g. after RE-EXTRACT or a claim) into the split session in
   * the store, so SplitPanel doesn't need its own copy of `stems` to stay in sync. */
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
  provisional: EditorJob,
  submit: () => Promise<{ jobId: string }>,
  onDone?: (job: EditorJob) => void,
): Promise<void> {
  if (get().editorJob) return; // one editor job at a time — mirrors the server's genLock
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
    } catch {
      continue;
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
    if (get().editorJob) return;
    const stems: StemResult[] = (['vocals', 'drums', 'bass', 'other'] as const).map((kind) => ({ kind, status: 'running' }));
    const provisional: SplitJobState = { kind: 'split', jobId: '', songId, layerId, splitJobId: '', stems, startedAt: Date.now(), stage: 'running' };
    set({ editorJob: provisional });
    let splitJobId: string;
    try {
      ({ jobId: splitJobId } = await api.startSplit(layerId, model));
    } catch (err) {
      set((s) => (s.editorJob === provisional ? { editorJob: { ...provisional, stage: 'failed', error: errMsg(err) } } : {}));
      return;
    }
    const job: SplitJobState = { ...provisional, jobId: splitJobId, splitJobId };
    set((s) => (s.editorJob === provisional ? { editorJob: job } : {}));

    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const current = get().editorJob;
      if (!current || current.kind !== 'split' || current.splitJobId !== splitJobId) return; // cancelled/superseded
      let result: Awaited<ReturnType<typeof api.splitStatus>>;
      try {
        result = await api.splitStatus(splitJobId);
      } catch (err) {
        // 404 = the job was force-stopped elsewhere (header's ABORT pill, or another
        // tab) — stemSplit.ts's cancelSplit deletes it outright, so unlike other job
        // kinds there's no "aborted" status to poll for. Any other error is transient.
        if (err instanceof ApiError && err.status === 404) {
          set((s) => (s.editorJob?.kind === 'split' && s.editorJob.splitJobId === splitJobId ? { editorJob: null } : {}));
          return;
        }
        continue;
      }
      set((s) => (s.editorJob?.kind === 'split' && s.editorJob.splitJobId === splitJobId
        ? { editorJob: { ...s.editorJob, stems: result.stems, stage: result.status === 'done' ? 'done' : 'running' } }
        : {}));
      // Keeps polling indefinitely (not just until the first "done") so a later RE-EXTRACT — which
      // flips one stem back to 'running' server-side — is picked up too. The session only ends via
      // cancelSplit(), which clears `editorJob` and makes the guard above return on the next tick.
    }
  },

  cancelSplit: async () => {
    const job = get().editorJob;
    if (job?.kind !== 'split') return;
    set({ editorJob: null });
    await api.cancelSplit(job.splitJobId).catch(() => {});
  },

  patchSplitStem: (stem) => set((s) => (s.editorJob?.kind === 'split'
    ? { editorJob: { ...s.editorJob, stems: s.editorJob.stems.map((x) => (x.kind === stem.kind ? stem : x)) } }
    : {})),
}));
