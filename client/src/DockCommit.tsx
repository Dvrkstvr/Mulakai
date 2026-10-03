import type { ReactNode } from 'react';
import type { SingleEditorJob } from './editorJob';
import { DockJobs } from './DockJobs';

interface Props {
  /** States what the commit will do, before it is pressed (AGENTS.md's consequence rule). */
  consequence: ReactNode;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
  onCommit?: () => void;
  /** A file to save instead of a job to start: renders the commit as a download link. */
  download?: { href: string; filename: string };
  /** Acid-outline siblings left of the commit (DESIGN's one-filled-CTA rule). */
  siblings?: ReactNode;
  /** This commit's own jobs still in flight, listed under the row. A busy GPU never disables
   * the commit: the server queues the next job (PLAN.md "UI Redesign", S4.7). */
  jobs?: SingleEditorJob[];
}

/** The dock's last row: consequence line, then the one filled acid control in the dock. */
export function DockCommit({ consequence, label, disabled, title, onCommit, download, siblings, jobs }: Props) {
  return (
    <>
      <div className="dock-commit">
        <span className="dock-consequence">{consequence}</span>
        {siblings}
        {download ? (
          <a className="dock-commit-btn dock-commit-link" href={download.href} download={download.filename}><span>{label}</span></a>
        ) : (
          <button className="acid dock-commit-btn" disabled={disabled} onClick={onCommit} title={title}>
            <span className="dock-commit-label">{label}</span>
          </button>
        )}
      </div>
      {jobs && <DockJobs jobs={jobs} />}
    </>
  );
}
