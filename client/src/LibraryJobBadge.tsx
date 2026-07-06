import { EDITOR_STAGE_LABEL, fmtElapsed, useElapsedMs } from './genProgress';
import type { EditorJob } from './editorJobStore';

/** Small inline status pill shown on a song's Library row while one of its layers is
 * mid-repaint/split/remaster/add-layer/regenerate/retake — see PLAN.md's note on jobs
 * surviving navigation: the job itself lives in editorJobStore.ts, this just reflects it. */
export function LibraryJobBadge({ job }: { job: EditorJob }) {
  const elapsedMs = useElapsedMs(job.stage === 'running', job.startedAt);
  return (
    <span className={job.stage === 'failed' ? 'library-job-badge failed' : 'library-job-badge'}>
      {job.stage === 'failed' ? 'FAILED' : EDITOR_STAGE_LABEL[job.kind]}
      {job.stage === 'running' && ` · ${fmtElapsed(elapsedMs)}`}
    </span>
  );
}
