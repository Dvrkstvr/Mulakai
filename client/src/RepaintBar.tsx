import { motion } from 'framer-motion';
import { REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS } from './repaintLimits';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { fmtElapsed, useElapsedMs } from './genProgress';
import type { Region } from './Waveform';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  layerName: string;
  /** The version number this repaint will create, e.g. 4 for "BASE v4" — states the consequence inline per AGENTS.md. */
  nextVersion: number;
  selection: Region | null;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  job: 'idle' | 'running';
  startedAt: number | null;
  /** True while a *different* generation (song gen, another layer's repaint, remaster, split…)
   * is running anywhere — disables this trigger proactively instead of just failing with a 409. */
  busyElsewhere: boolean;
  onRepaint: () => void;
  error: string;
}

/** Scope chip + prompt input + REPAINT REGION commit, re-targetable to whichever layer is focused. */
export function RepaintBar({ layerName, nextVersion, selection, prompt, onPromptChange, job, startedAt, busyElsewhere, onRepaint, error }: Props) {
  const regionSeconds = selection ? selection.end - selection.start : 0;
  const regionTooShort = !!selection && regionSeconds < REPAINT_MIN_SECONDS;
  const regionTooLong = !!selection && regionSeconds > REPAINT_MAX_SECONDS;
  const regionValid = !!selection && !regionTooShort && !regionTooLong;
  const elapsedMs = useElapsedMs(job === 'running', startedAt);

  return (
    <>
      <motion.section className="repaint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 }}>
        <motion.div className={`scope-chip${regionTooShort || regionTooLong ? ' warn' : ''}`} layout>
          {!selection ? 'NO SELECTION'
            : regionTooShort ? `${fmt(selection.start)}–${fmt(selection.end)} · MIN ${REPAINT_MIN_SECONDS}s`
              : regionTooLong ? `${fmt(selection.start)}–${fmt(selection.end)} · MAX ${REPAINT_MAX_SECONDS}s`
                : `${fmt(selection.start)}–${fmt(selection.end)} · ${layerName.toUpperCase()}`}
        </motion.div>
        <input
          placeholder="Describe what should change in the selected region"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <motion.button
          className="acid"
          animate={job === 'running' ? {
            skewX: 0,
            backgroundColor: 'transparent',
            color: '#D4FF00'
          } : {
            skewX: regionValid ? -10 : 0,
            backgroundColor: '#D4FF00',
            color: '#1C1D21'
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative', overflow: 'hidden' }}
          disabled={!regionValid || job === 'running' || busyElsewhere}
          onClick={onRepaint}
        >
          {job === 'running' ? (
            <>
              <AIGeneratingBackground />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                REPAINTING… {fmtElapsed(elapsedMs)}
              </span>
            </>
          ) : busyElsewhere ? 'BUSY ELSEWHERE' : 'REPAINT REGION'}
        </motion.button>
      </motion.section>
      {regionValid && job !== 'running' && !busyElsewhere && (
        <div className="hint">will save as {layerName.toUpperCase()} v{nextVersion}</div>
      )}
      {busyElsewhere && job !== 'running' && (
        <div className="hint">a generation is already running elsewhere — try again once it finishes</div>
      )}
      {error && <div className="error">{error} <button onClick={onRepaint}>RETRY</button></div>}
    </>
  );
}
