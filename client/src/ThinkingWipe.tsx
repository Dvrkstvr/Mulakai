import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { ThinkingPhase } from './useThinkingQuery';

interface Props {
  phase: ThinkingPhase;
  onSwept: () => void;
}

/** Shimmer-then-wipe overlay for the Quick Start "AI thinking" reveal — shimmers solid
 * while the LM is working, then sweeps left-to-right once the result lands, timed with
 * the typewriter fill underneath (CreateView.tsx). Extends the lilac/sky/acid shimmer
 * exception beyond DESIGN.md's three listed cases — see this PR's DESIGN.md update. */
export function ThinkingWipe({ phase, onSwept }: Props) {
  if (phase === 'idle') return null;
  return (
    <motion.div
      className="thinking-wipe"
      initial={{ clipPath: 'inset(0 0 0 0%)' }}
      animate={{ clipPath: phase === 'revealing' ? 'inset(0 0 0 100%)' : 'inset(0 0 0 0%)' }}
      transition={{ duration: 0.7, ease: 'easeIn' }}
      onAnimationComplete={() => { if (phase === 'revealing') onSwept(); }}
    >
      <AIGeneratingBackground />
      <span className="thinking-wipe-label">THINKING…</span>
    </motion.div>
  );
}
