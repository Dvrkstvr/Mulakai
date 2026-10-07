import { Fragment, useState } from 'react';
import { useApiStatusStore } from './apiStatusStore';
import { confirmChip, targetKey, type ChipTarget } from './createBarActions';
import { abortableGenKeys, CONFIRM_COPY, draftChipText, genChips, type GenChip } from './createBarStatus';
import { ChipConfirm, DraftChip, GenerationChip, OverflowChip, ThinkingChip } from './CreateBarChip';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useQueueStore } from './queueStore';
import { useCreateBusy } from './useCreateBusy';
import { useRunningRows } from './useRunningRows';
import './createBarChips.css';

type GenTarget = Extract<ChipTarget, { jobId: string }>;
const genTarget = (c: GenChip): GenTarget | null => (c.action ? { kind: c.action, jobId: c.jobId } : null);

/** Status chips between FEELING LUCKY and the input (PLAN.md "Create Bar Status Chips", "Create Bar
 * Mirrors Create"): what Create is doing — Quick Start thinking, song generations in flight, the
 * draft — each with a quick action confirmed in place. */
export function CreateBarChips() {
  const [confirming, setConfirming] = useState<string | null>(null);
  const jobs = useGenerationStore((s) => s.jobs);
  const rows = useRunningRows();
  const cancelling = useQueueStore((s) => s.cancelling);
  const aborting = useApiStatusStore((s) => s.aborting);
  const draftText = useCreateDraftStore((s) => draftChipText(s));
  const { think, draftEmpty } = useCreateBusy();

  const { chips, overflow } = genChips(jobs, abortableGenKeys(rows));
  const keep = () => setConfirming(null);
  const confirm = (t: ChipTarget) => { setConfirming(null); void confirmChip(t); };
  // Derived: a chip whose job settled, or a draft emptied elsewhere, drops its confirm.
  const asking = (t: ChipTarget | null) => !!t && confirming === targetKey(t);

  return (
    <Fragment>
      {think && (asking({ kind: 'stop' })
        ? <ChipConfirm copy={CONFIRM_COPY.stop} onConfirm={() => confirm({ kind: 'stop' })} onKeep={keep} />
        : <ThinkingChip chip={think} onAskStop={() => setConfirming('stop')} />)}
      {chips.map((c) => {
        const t = genTarget(c);
        if (t && asking(t)) return <ChipConfirm key={c.key} copy={CONFIRM_COPY[t.kind]} onConfirm={() => confirm(t)} onKeep={keep} />;
        const busy = c.action === 'cancel' ? cancelling.includes(c.jobId) : c.action === 'abort' && aborting;
        return <GenerationChip key={c.key} chip={c} busy={busy} onAsk={() => t && setConfirming(targetKey(t))} />;
      })}
      {overflow > 0 && <OverflowChip count={overflow} />}
      {!draftEmpty && (asking({ kind: 'draft' })
        ? <ChipConfirm copy={CONFIRM_COPY.clear} onConfirm={() => confirm({ kind: 'draft' })} onKeep={keep} />
        : <DraftChip text={draftText} onAskClear={() => setConfirming('draft')} />)}
    </Fragment>
  );
}
