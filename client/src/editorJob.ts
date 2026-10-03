import type { StemResult } from './api';

export type Stage = 'running' | 'done' | 'failed';

interface JobBase {
  /** This tab's handle on the job, set at submit: the server's `jobId` arrives only once the
   * submit answers, and several jobs of one kind can be in flight at once (PLAN.md "UI
   * Redesign", S4.7). */
  key: string;
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
  /** Starts the same job again with the same arguments (Activity's RETRY on a failed row),
   * replacing this one. False when nothing started. */
  retry?: () => boolean;
}

/** What a repaint or add layer was submitted with: once it lands, the dock clears only fields
 * that still hold exactly this, never work the user started after committing it. */
export interface RepaintSubmission { prompt: string; start: number; end: number }
export interface AddLayerSubmission { prompt: string; trackName: string; lyrics: string }

export interface RepaintJob extends JobBase { kind: 'repaint'; layerId: string; submitted?: RepaintSubmission }
export interface RegenerateJob extends JobBase { kind: 'regenerate'; layerId: string; versionId: string }
export interface RetakeJob extends JobBase { kind: 'retake'; layerId: string; versionId: string }
export interface AddLayerJob extends JobBase { kind: 'addLayer'; submitted?: AddLayerSubmission }
export interface RemasterJob extends JobBase { kind: 'remaster' }
export interface SplitJobState extends JobBase { kind: 'split'; layerId: string; splitJobId: string; stems: StemResult[] }

export type EditorJob = RepaintJob | RegenerateJob | RetakeJob | AddLayerJob | RemasterJob | SplitJobState;
/** Every kind but split, which has its own store slot: a settled split stays open for its
 * stems while other editor jobs run. */
export type SingleEditorJob = Exclude<EditorJob, SplitJobState>;

/** Whether an editor job is still in flight (waiting in the queue, running, or lingering as
 * done). A failed job stays in the store only so its own panel can show the error and RETRY. */
export function isEditorBusy(job: EditorJob | null | undefined): boolean {
  return !!job && job.stage !== 'failed';
}

/** This tab's editor jobs of one kind matching every id given, oldest first — lets a component
 * tell its own jobs apart from everything else in flight. */
export function myEditorJobs<K extends SingleEditorJob['kind']>(
  jobs: SingleEditorJob[], kind: K, ids: Partial<Record<'songId' | 'layerId' | 'versionId', string>>,
): (SingleEditorJob & { kind: K })[] {
  return jobs.filter((job): job is SingleEditorJob & { kind: K } => {
    if (job.kind !== kind) return false;
    const record = job as unknown as Record<string, unknown>;
    return Object.entries(ids).every(([key, value]) => value === undefined || record[key] === value);
  });
}

/** What a commit shows about its own jobs: the one running now (not waiting), the ones still
 * in flight, the newest failure (for its error line), and those that landed (with their keys
 * as one comparable string, for an effect to key on). */
export function jobView<J extends SingleEditorJob>(mine: J[]) {
  const inFlight = mine.filter((j) => j.stage === 'running');
  const landedJobs = mine.filter((j) => j.stage === 'done');
  return {
    inFlight,
    running: inFlight.find((j) => !j.queuePosition) ?? null,
    failed: [...mine].reverse().find((j) => j.stage === 'failed') ?? null,
    landedJobs,
    landed: landedJobs.map((j) => j.key).join(','),
  };
}
