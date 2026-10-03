import type { StemResult } from './api';

export type Stage = 'running' | 'done' | 'failed';

interface JobBase {
  jobId: string;
  songId: string;
  startedAt: number;
  stage: Stage;
  error?: string;
  /** Set while the job waits in the server's queue (1 = next); the stage still reads `running`. */
  queuePosition?: number;
  progress?: number; // live progress from ACE-Step's /query_result, refreshed each poll tick
  progressStage?: string;
  progressText?: string;
  /** Starts the same job again with the same arguments (Activity's RETRY on a failed row).
   * False when another editor job holds the slot, so nothing started. */
  retry?: () => boolean;
}

export interface RepaintJob extends JobBase { kind: 'repaint'; layerId: string }
export interface RegenerateJob extends JobBase { kind: 'regenerate'; layerId: string; versionId: string }
export interface RetakeJob extends JobBase { kind: 'retake'; layerId: string; versionId: string }
export interface AddLayerJob extends JobBase { kind: 'addLayer' }
export interface RemasterJob extends JobBase { kind: 'remaster' }
export interface SplitJobState extends JobBase { kind: 'split'; layerId: string; splitJobId: string; stems: StemResult[] }

export type EditorJob = RepaintJob | RegenerateJob | RetakeJob | AddLayerJob | RemasterJob | SplitJobState;
/** Every kind but split, which has its own store slot: a settled split stays open for its
 * stems while other editor jobs run. */
export type SingleEditorJob = Exclude<EditorJob, SplitJobState>;

/** Whether an editor job still holds the server's lock. A failed job stays in the store only
 * so its own panel can show the error and RETRY — the server already released the lock, so it
 * must not block another editor action or a new start (mirrors `isGenerating`). */
export function isEditorBusy(job: EditorJob | null): boolean {
  return !!job && job.stage !== 'failed';
}

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
