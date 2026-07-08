import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApiStatusStore } from './apiStatusStore';

interface Props {
  online: boolean | null;
  left: ReactNode;
  right: ReactNode;
  /** FORGE is feature-gated (Settings > Forge) — its header icon only renders when enabled, per FORGE_PLAN.md. */
  forgeEnabled?: boolean;
  onForge?: () => void;
}

const STATUS_POLL_MS = 2000;

/** Persistent app header — logo glides via a shared layoutId as the back-button/title slots mount around it on view change. */
export function Header({ online, left, right, forgeEnabled, onForge }: Props) {
  const active = useApiStatusStore((s) => s.active);
  const aborting = useApiStatusStore((s) => s.aborting);
  const poll = useApiStatusStore((s) => s.poll);
  const abort = useApiStatusStore((s) => s.abort);

  // Independent of generationStore/editorJobStore's own polling — this pill needs to
  // reflect ANY job kind (generate/repaint/split/remaster/...), not just whichever one
  // the current screen happens to be tracking in detail.
  useEffect(() => {
    poll();
    const timer = setInterval(poll, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  return (
    <motion.header layout transition={{ duration: 0.25, ease: 'easeOut' }}>
      <AnimatePresence mode="popLayout">
        {left && (
          <motion.div key="header-left" layout className="header-slot"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}>
            {left}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.span layout="position" layoutId="logo" className="logo">MULAKAI</motion.span>
      <AnimatePresence mode="popLayout">
        {right && (
          <motion.div key="header-right" layout className="header-slot"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, delay: 0.05 }}>
            {right}
          </motion.div>
        )}
      </AnimatePresence>
      {forgeEnabled && (
        <button className="forge-icon" onClick={onForge} aria-label="Forge" title="Forge (experimental)">F</button>
      )}
      <span className="header-status">
        {active && (
          <span className="job-status-pill" title={active.error ?? undefined}>
            <span className="job-status-label">{active.kind.toUpperCase()} · {active.status.toUpperCase()}</span>
            <button className="job-abort-btn" onClick={() => abort()} disabled={aborting}>
              {aborting ? '…' : 'ABORT'}
            </button>
          </span>
        )}
        <span className={`health ${online ? 'ok' : 'down'}`}>
          ACE-STEP {online === null ? '…' : online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </span>
    </motion.header>
  );
}
