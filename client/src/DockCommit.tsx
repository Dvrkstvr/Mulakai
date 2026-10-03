import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';

interface Props {
  /** States what the commit will do, before it is pressed (AGENTS.md's consequence rule). */
  consequence: ReactNode;
  label: ReactNode;
  disabled?: boolean;
  /** An AI job this commit started is in flight: the button wears the shader, veiled by `progress`. */
  running?: boolean;
  progress?: number;
  title?: string;
  onCommit?: () => void;
  /** A file to save instead of a job to start: renders the commit as a download link. */
  download?: { href: string; filename: string };
  /** Acid-outline siblings left of the commit (DESIGN's one-filled-CTA rule). */
  siblings?: ReactNode;
}

/** The dock's last row: consequence line, then the one filled acid control in the dock. */
export function DockCommit({ consequence, label, disabled, running, progress, title, onCommit, download, siblings }: Props) {
  return (
    <div className="dock-commit">
      <span className="dock-consequence">{consequence}</span>
      {siblings}
      {download ? (
        <a className="dock-commit-btn dock-commit-link" href={download.href} download={download.filename}><span>{label}</span></a>
      ) : (
        <motion.button
          className="acid dock-commit-btn"
          animate={running
            ? { backgroundColor: 'rgba(0,0,0,0)', color: '#D4FF00' }
            : { backgroundColor: '#D4FF00', color: '#1C1D21' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          disabled={disabled || running}
          onClick={onCommit}
          title={title}
        >
          {running && <AIGeneratingBackground progress={progress} />}
          <span className="dock-commit-label">{label}</span>
        </motion.button>
      )}
    </div>
  );
}
