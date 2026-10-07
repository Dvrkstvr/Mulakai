/** The create bar's chips as plain views, no hooks: CreateBarChips.tsx owns the stores and which
 * chip is confirming, so these render (and are tested) from props alone. */
import type { KeyboardEvent } from 'react';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { ChipCopy, GenChip, ThinkChip } from './createBarStatus';

interface ConfirmProps {
  copy: ChipCopy;
  onConfirm: () => void;
  onKeep: () => void;
}

/** A chip turned into its own confirm: the consequence line, then a rust confirm and a quiet
 * KEEP (DESIGN.md: a consequence line before every destructive commit). Escape keeps. */
export function ChipConfirm({ copy, onConfirm, onKeep }: ConfirmProps) {
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeep(); };
  return (
    <div className="cb-chip confirm" role="group" aria-label="Confirm" onKeyDown={onKeyDown}>
      <span className="cb-chip-consequence">{copy.consequence}</span>
      <button type="button" className="cb-chip-btn danger" onClick={onConfirm}><span>{copy.confirm}</span></button>
      {/* Focus lands on the safe choice, so Escape and Enter both keep. */}
      <button type="button" className="cb-chip-btn" onClick={onKeep} autoFocus><span>KEEP</span></button>
    </div>
  );
}

interface DraftProps {
  text: string;
  onAskClear: () => void;
}

/** Create's draft. Opening it is the bar's TO CREATE, so the chip only offers CLEAR. */
export function DraftChip({ text, onAskClear }: DraftProps) {
  return (
    <div className="cb-chip">
      <span className="cb-chip-label">DRAFT</span>
      <span className="cb-chip-title" title={text}>{text}</span>
      <button type="button" className="cb-chip-btn" onClick={onAskClear}><span>CLEAR</span></button>
    </div>
  );
}

interface GenProps {
  chip: GenChip;
  /** The action is in flight (CANCELLING… / ABORTING…). */
  busy: boolean;
  onAsk: () => void;
}

const ACTION_LABEL = { cancel: ['CANCEL', 'CANCELLING…'], abort: ['ABORT', 'ABORTING…'] } as const;

export function GenerationChip({ chip, busy, onAsk }: GenProps) {
  return (
    <div className={chip.ai ? 'cb-chip ai' : 'cb-chip queued'}>
      {chip.ai && <AIGeneratingBackground progress={chip.veil} />}
      <span className="cb-chip-label">{chip.label}</span>
      <span className="cb-chip-title" title={chip.title}>{chip.title}</span>
      {chip.pct && <span className="cb-chip-pct">{chip.pct}</span>}
      {chip.action && (
        <button type="button" className="cb-chip-btn" disabled={busy} onClick={onAsk}>
          <span>{ACTION_LABEL[chip.action][busy ? 1 : 0]}</span>
        </button>
      )}
    </div>
  );
}

interface ThinkProps {
  chip: ThinkChip;
  onAskStop: () => void;
}

/** Quick Start writing the draft. TO CREATE shows it there (the reveal, or the error's RETRY). */
export function ThinkingChip({ chip, onAskStop }: ThinkProps) {
  return (
    <div className={chip.ai ? 'cb-chip ai' : chip.failed ? 'cb-chip failed' : 'cb-chip queued'}>
      {chip.ai && <AIGeneratingBackground />}
      <span className="cb-chip-label">{chip.label}</span>
      <span className="cb-chip-title" title={chip.title}>{chip.title}</span>
      <button type="button" className="cb-chip-btn" onClick={onAskStop}><span>STOP</span></button>
    </div>
  );
}

export function OverflowChip({ count }: { count: number }) {
  return <div className="cb-chip more" title={`${count} more in Activity`}><span className="cb-chip-label">+{count}</span></div>;
}
