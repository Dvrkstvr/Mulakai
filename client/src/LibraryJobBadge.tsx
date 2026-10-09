import { EDITOR_STAGE_LABEL, fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';
import { useEditorJobStore } from './editorJobStore';
import { songBadgeJob } from './dockJobLine';

/** Small inline status pill shown on a song's Library row while one of its layers is
 * mid-repaint/split/remaster/add-layer/regenerate/retake — see PLAN.md's note on jobs
 * surviving navigation: the job itself lives in editorJobStore.ts, this just reflects it.
 * An editor job wins over an open split on the same song: it's the one doing something; of
 * several, the one running beats those waiting in the queue, and either beats a failure.
 * A click opens the Editor on the verb and layer that show this job (useEditorFocus). */
export function LibraryJobBadge({ songId, onOpen }: { songId: string; onOpen: () => void }) {
  const job = useEditorJobStore((s) => songBadgeJob(s.editorJobs, s.splitJob, songId));
  const working = job?.stage === 'running' && !job.queuePosition;
  const elapsedMs = useElapsedMs(working, job?.startedAt ?? null);
  if (!job) return null;
  return (
    <button type="button" className={job.stage === 'failed' ? 'library-job-badge failed' : 'library-job-badge'}
      title={job.progressText ?? 'Open in the Editor'} onClick={onOpen}>
      {job.stage === 'failed' ? 'FAILED' : EDITOR_STAGE_LABEL[job.kind]}
      {job.stage === 'running' && !working && ' · QUEUED'}
      {working && ` · ${fmtElapsed(elapsedMs)}`}
      {working && fmtProgress(job.progress) && ` · ${fmtProgress(job.progress)}`}
      {working && stageDetail(job.progressStage) && ` · ${stageDetail(job.progressStage)}`}
    </button>
  );
}
