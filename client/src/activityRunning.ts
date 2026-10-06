/** Activity's RUNNING section (PLAN.md "UI Redesign", S3.5), read live from the stores that own
 * each job, plus the server's running job (`/active`) for one none of them track: ANALYZE AUDIO,
 * a job started in another tab, or anything running before a reload. A job a store follows that
 * still waits in the server's queue is UP NEXT instead (S4). */
import type { ActiveGeneration } from './api';
import type { ActivityKind } from './activitySettle';
import type { SingleEditorJob, SplitJobState } from './editorJob';
import { EDITOR_STAGE_LABEL } from './genProgress';
import type { GenerationJob } from './generationStore';
import type { TimingsRun } from './timingsStore';

export interface RunningRow {
  key: string;
  kind: ActivityKind;
  jobId?: string;
  label: string;
  songId?: string;
  title?: string;
  startedAt?: number;
  progress?: number;
  /** Progress is a share of the current engine stage, not the whole job: no veil. */
  stageProgress?: boolean;
  /** A job that makes or describes audio wears the AI shader (DESIGN.md "AI states"). */
  ai: boolean;
  /** This row is what holds the server's lock, so ABORT stops it. */
  abortable: boolean;
}

export interface RunningSources {
  genJobs: GenerationJob[];
  editorJobs: SingleEditorJob[];
  splitJob: SplitJobState | null;
  transcribe: { stage: string; progress?: number; jobId?: string };
  readLyrics: { stage: string; jobId?: string };
  timings: Record<string, TimingsRun>;
  active: ActiveGeneration | null;
  /** Jobs still waiting in the server's queue: those are UP NEXT, not RUNNING. */
  queuedIds?: ReadonlySet<string>;
  /** Jobs Activity already lists as DONE or FAILED: a `/active` snapshot taken before they
   * settled (it is polled every 2 s) must not list them as RUNNING again. */
  settledIds?: ReadonlySet<string>;
}

const AI_KINDS = new Set<ActivityKind>(['generate', 'repaint', 'regenerate', 'retake', 'addLayer', 'remaster', 'analyze']);

export const RUNNING_LABEL: Record<ActivityKind, string> = {
  generate: 'GENERATING', ...EDITOR_STAGE_LABEL,
  transcribe: 'TRANSCRIBING', lyrics: 'READING LYRICS', timings: 'TIMING LYRICS', analyze: 'ANALYZING AUDIO',
  lm: 'LM WRITING', plan: 'PLANNING SCORE', scoreRender: 'RENDERING SCORE',
};

type Draft = Omit<RunningRow, 'ai' | 'abortable' | 'label'> & { label?: string };

export function runningRows(src: RunningSources, isEngineStage: (stage?: string) => boolean = () => false): RunningRow[] {
  let drafts: Draft[] = [];
  const { splitJob, active } = src;
  for (const genJob of src.genJobs) {
    if ((genJob.stage !== 'loading' && genJob.stage !== 'running') || genJob.queuePosition) continue;
    drafts.push({
      key: `generate:${genJob.key}`, kind: 'generate', jobId: genJob.jobId, title: genJob.title,
      label: genJob.stage === 'loading' ? 'LOADING MODEL' : undefined, songId: genJob.songId,
      startedAt: genJob.startedAt, progress: genJob.progress, stageProgress: isEngineStage(genJob.progressStage),
    });
  }
  for (const editorJob of src.editorJobs) {
    if (editorJob.stage !== 'running' || editorJob.queuePosition) continue;
    drafts.push({
      key: `${editorJob.kind}:${editorJob.key}`, kind: editorJob.kind, jobId: editorJob.jobId,
      songId: editorJob.songId, startedAt: editorJob.startedAt, progress: editorJob.progress,
    });
  }
  if (splitJob?.stage === 'running' && !splitJob.queuePosition) {
    const done = splitJob.stems.filter((s) => s.status !== 'running').length;
    drafts.push({
      key: `split:${splitJob.startedAt}`, kind: 'split', jobId: splitJob.splitJobId, songId: splitJob.songId,
      startedAt: splitJob.startedAt, progress: splitJob.stems.length ? done / splitJob.stems.length : undefined,
    });
  }
  if (src.transcribe.stage === 'running') {
    drafts.push({ key: 'transcribe', kind: 'transcribe', jobId: src.transcribe.jobId, progress: src.transcribe.progress });
  }
  if (src.readLyrics.stage === 'running') drafts.push({ key: 'lyrics', kind: 'lyrics', jobId: src.readLyrics.jobId });
  for (const [versionId, run] of Object.entries(src.timings)) {
    if (run.stage === 'running') drafts.push({ key: `timings:${versionId}`, kind: 'timings', jobId: run.jobId });
  }
  const queued = src.queuedIds;
  if (queued?.size) drafts = drafts.filter((d) => !d.jobId || !queued.has(d.jobId));

  // The lock names its job; one this tab tracks matches by id, or (no id kept) by kind.
  const live = active && (active.status === 'loading' || active.status === 'running');
  const holder = live && !src.settledIds?.has(active.jobId) ? active : null;
  const holderIndex = holder ? drafts.findIndex((d) => d.jobId === holder.jobId) : -1;
  const matched = holderIndex >= 0 ? holderIndex : holder ? drafts.findIndex((d) => d.kind === holder.kind) : -1;
  if (holder && matched < 0) {
    drafts.push({
      key: `active:${holder.jobId}`, kind: holder.kind, jobId: holder.jobId, songId: holder.songId,
      title: holder.title, startedAt: holder.startedAt,
    });
  }
  return drafts.map((d, i) => {
    const row: RunningRow = { ...d, label: d.label ?? RUNNING_LABEL[d.kind], ai: AI_KINDS.has(d.kind), abortable: false };
    if (holder) {
      row.abortable = i === (matched >= 0 ? matched : drafts.length - 1);
      if (row.abortable) { row.songId ??= holder.songId; row.title ??= holder.title; }
    }
    return row;
  });
}
