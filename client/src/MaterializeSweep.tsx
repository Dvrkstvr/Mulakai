import { motion } from 'framer-motion';

/** One-time scanline sweep played on entry into Create/Editor — marks these as the "working" screens, per docs/design/DESIGN.md#Motion. Entry-only; never plays on exit. */
export function MaterializeSweep() {
  return (
    <motion.div
      aria-hidden
      initial={{ x: '-100%', opacity: 1 }}
      animate={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'fixed', top: 0, left: 0, width: '40%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(48,188,237,0.25), rgba(212,255,0,0.2), transparent)',
        pointerEvents: 'none', zIndex: 50,
      }}
    />
  );
}
