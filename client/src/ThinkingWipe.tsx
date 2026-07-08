import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { ThinkingPhase } from './useThinkingQuery';

interface Props {
  phase: ThinkingPhase;
  onSwept: () => void;
  /** Defaults to 900ms — CreateView's longest paired typewrite() call (lyrics). */
  durationMs?: number;
}

/** Shimmer-then-wipe overlay for the Quick Start "AI thinking" reveal — shimmers solid
 * while the LM is working, then sweeps left-to-right once the result lands, timed with
 * the typewriter fill underneath (CreateView.tsx). Extends the lilac/sky/acid shimmer
 * exception beyond DESIGN.md's three listed cases — see this PR's DESIGN.md update.
 * `durationMs` must be >= the longest typewrite() call it's paired with — CreateView's
 * lyrics typewriter runs 900ms vs. the prompt's 700ms, and a shorter wipe used to fire
 * onSwept (which cancels both typewriters) before the lyrics animation finished,
 * silently truncating the LM's lyrics before the user ever saw or could edit them. */
export function ThinkingWipe({ phase, onSwept, durationMs = 900 }: Props) {
  if (phase === 'idle') return null;
  return (
    <motion.div
      className="thinking-wipe"
      initial={{ clipPath: 'inset(0 0 0 0%)' }}
      animate={{ clipPath: phase === 'revealing' ? 'inset(0 0 0 100%)' : 'inset(0 0 0 0%)' }}
      transition={{ duration: durationMs / 1000, ease: 'easeIn' }}
      onAnimationComplete={() => { if (phase === 'revealing') onSwept(); }}
    >
      <AIGeneratingBackground />
      <span className="thinking-wipe-label">THINKING…</span>
    </motion.div>
  );
}
