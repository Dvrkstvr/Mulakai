import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  online: boolean | null;
  left: ReactNode;
  right: ReactNode;
}

/** Persistent app header — logo glides via a shared layoutId as the back-button/title slots mount around it on view change. */
export function Header({ online, left, right }: Props) {
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
      <span className={`health ${online ? 'ok' : 'down'}`}>
        ACE-STEP {online === null ? '…' : online ? 'ONLINE' : 'OFFLINE'}
      </span>
    </motion.header>
  );
}
