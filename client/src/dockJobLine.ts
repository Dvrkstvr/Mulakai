/** What the Editor says about its own jobs in flight (PLAN.md "UI Redesign", S4.7). Pure. */
import type { EditorJob, SingleEditorJob, SplitJobState } from './editorJob';
import { EDITOR_STAGE_LABEL, fmtElapsed, fmtProgress, stageDetail } from './genProgress';
import { startsAfter } from './queueCopy';

/** One of a commit's own jobs, under its row: "REPAINTING… 0:42 · 38%", or, still waiting,
 * "REPAINTING · QUEUED · STARTS AFTER 1 JOB". */
export function dockJobLine(job: SingleEditorJob, elapsedMs: number): string {
  const label = EDITOR_STAGE_LABEL[job.kind];
  if (!job.jobId) return `${label} · STARTING…`;
  if (job.queuePosition) return `${label} · QUEUED · ${startsAfter(job.queuePosition).toUpperCase()}`;
  const progress = fmtProgress(job.progress);
  const stage = stageDetail(job.progressStage);
  return `${label}… ${fmtElapsed(elapsedMs)}${progress ? ` · ${progress}` : ''}${stage ? ` · ${stage}` : ''}`;
}

/** The job a song's Library row badges: an editor job wins over an open split (it's the one
 * doing something); of several, the one running beats those waiting, and either a failure. */
export function songBadgeJob(jobs: SingleEditorJob[], split: SplitJobState | null, songId: string): EditorJob | null {
  const mine = jobs.filter((j) => j.songId === songId);
  return mine.find((j) => j.stage === 'running' && !j.queuePosition) ?? mine.find((j) => j.stage !== 'failed')
    ?? mine.find((j) => j.stage === 'failed') ?? (split?.songId === songId ? split : null);
}
