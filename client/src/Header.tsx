import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApiStatusStore } from './apiStatusStore';
import { ModelStatusBadge } from './ModelStatusBadge';
import { ActivityButton } from './ActivityButton';
import { useCommandStore } from './commandStore';

interface Props {
  left: ReactNode;
  right: ReactNode;
  /** FORGE is feature-gated (Settings > Forge) — its header icon only renders when enabled, per FORGE_PLAN.md. */
  forgeEnabled?: boolean;
  onForge?: () => void;
}

const STATUS_POLL_MS = 2000;

/** Persistent app header — logo glides via a shared layoutId as the back-button/title slots mount around it on view change. */
export function Header({ left, right, forgeEnabled, onForge }: Props) {
  const poll = useApiStatusStore((s) => s.poll);
  const openPalette = useCommandStore((s) => s.setOpen);

  // Independent of generationStore/editorJobStore's own polling: Activity's RUNNING needs to
  // see ANY job kind (analyze, another tab's job), not just the ones this tab tracks in detail.
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
      <button type="button" className="palette-trigger" onClick={() => openPalette(true)}>
        <span className="palette-trigger-text">Search or run anything…</span>
        <span className="kbd">CTRL K</span>
      </button>
      {forgeEnabled && (
        <button className="forge-icon" onClick={onForge} aria-label="Forge" title="Forge (experimental)">F</button>
      )}
      <span className="header-status">
        <ActivityButton />
        <ModelStatusBadge />
      </span>
    </motion.header>
  );
}
