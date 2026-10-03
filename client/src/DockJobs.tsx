import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { SingleEditorJob } from './editorJob';
import { useElapsedMs } from './genProgress';
import { dockJobLine } from './dockJobLine';

function DockJobLine({ job }: { job: SingleEditorJob }) {
  const working = !!job.jobId && !job.queuePosition;
  const elapsedMs = useElapsedMs(working, job.startedAt);
  return (
    <div className={working ? 'dock-job' : 'dock-job waiting'} title={working ? job.progressText : undefined}>
      {/* Only a job the GPU is working on wears the shader (DESIGN.md "AI states"). */}
      {working && <AIGeneratingBackground progress={job.progress} />}
      <span className="dock-job-label">{dockJobLine(job, elapsedMs)}</span>
    </div>
  );
}

/** A commit's own jobs still in flight, one line each under its commit row (PLAN.md "UI
 * Redesign", S4.7): the commit stays free for the next job, so what it already started shows
 * here instead of on the button. */
export function DockJobs({ jobs }: { jobs: SingleEditorJob[] }) {
  if (jobs.length === 0) return null;
  return <div className="dock-jobs">{jobs.map((job) => <DockJobLine key={job.key} job={job} />)}</div>;
}
