import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';

interface Props {
  submitting: boolean;
  /** Why the server's lock refuses a start right now (busyMessage), naming the job holding it —
   * anywhere in the app, not just this tab. Null when free. */
  blocked: string | null;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** The acid "commit" button both Create tabs end with — identical shape (skew-to-flat +
 * AIGeneratingBackground veil while submitting), only the idle label differs. */
export function GenerateButton({ submitting, blocked, label, disabled, onClick }: Props) {
  return (
    <div className="generate-row">
      <motion.button
        className="acid"
        animate={submitting ? { skewX: 0, backgroundColor: 'transparent', color: '#D4FF00' } : { skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden' }}
        disabled={disabled}
        onClick={onClick}
      >
        {submitting ? (
          <>
            <AIGeneratingBackground />
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>STARTING…</span>
          </>
        ) : blocked ?? label}
      </motion.button>
    </div>
  );
}
