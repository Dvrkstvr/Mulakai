import { EDITOR_STAGE_LABEL, fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';
import { useEditorJobStore } from './editorJobStore';

/** Small inline status pill shown on a song's Library row while one of its layers is
 * mid-repaint/split/remaster/add-layer/regenerate/retake — see PLAN.md's note on jobs
 * surviving navigation: the job itself lives in editorJobStore.ts, this just reflects it.
 * An editor job wins over an open split on the same song: it's the one doing something. */
export function LibraryJobBadge({ songId }: { songId: string }) {
  const job = useEditorJobStore((s) => (s.editorJob?.songId === songId ? s.editorJob : s.splitJob?.songId === songId ? s.splitJob : null));
  const elapsedMs = useElapsedMs(job?.stage === 'running', job?.startedAt ?? null);
  if (!job) return null;
  return (
    <span className={job.stage === 'failed' ? 'library-job-badge failed' : 'library-job-badge'} title={job.progressText}>
      {job.stage === 'failed' ? 'FAILED' : EDITOR_STAGE_LABEL[job.kind]}
      {job.stage === 'running' && ` · ${fmtElapsed(elapsedMs)}`}
      {job.stage === 'running' && fmtProgress(job.progress) && ` · ${fmtProgress(job.progress)}`}
      {job.stage === 'running' && stageDetail(job.progressStage) && ` · ${stageDetail(job.progressStage)}`}
    </span>
  );
}
