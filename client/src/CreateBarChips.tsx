import { Fragment, useState } from 'react';
import { useApiStatusStore } from './apiStatusStore';
import { confirmChip, targetKey, type ChipTarget } from './createBarActions';
import { abortableGenKeys, CONFIRM_COPY, genChips, type GenChip } from './createBarStatus';
import { ChipConfirm, GenerationChip, OverflowChip } from './CreateBarChip';
import { useGenerationStore } from './generationStore';
import { useQueueStore } from './queueStore';
import { useRunningRows } from './useRunningRows';
import './createBarChips.css';

const genTarget = (c: GenChip): ChipTarget | null => (c.action ? { kind: c.action, jobId: c.jobId } : null);

/** The song generations in flight, as chips in the create bar (PLAN.md "Create Bar Status
 * Chips"), each with its CANCEL / ABORT confirmed in place. Create's own work — the draft, or
 * Quick Start writing one — is the CreateCard beside them. */
export function CreateBarChips() {
  const [confirming, setConfirming] = useState<string | null>(null);
  const jobs = useGenerationStore((s) => s.jobs);
  const rows = useRunningRows();
  const cancelling = useQueueStore((s) => s.cancelling);
  const aborting = useApiStatusStore((s) => s.aborting);

  const { chips, overflow } = genChips(jobs, abortableGenKeys(rows));
  const keep = () => setConfirming(null);
  const confirm = (t: ChipTarget) => { setConfirming(null); void confirmChip(t); };

  return (
    <Fragment>
      {chips.map((c) => {
        const t = genTarget(c);
        // Derived: a chip whose job settled drops its confirm.
        if (t && confirming === targetKey(t)) {
          return <ChipConfirm key={c.key} copy={CONFIRM_COPY[t.kind]} onConfirm={() => confirm(t)} onKeep={keep} />;
        }
        const busy = c.action === 'cancel' ? cancelling.includes(c.jobId) : c.action === 'abort' && aborting;
        return <GenerationChip key={c.key} chip={c} busy={busy} onAsk={() => t && setConfirming(targetKey(t))} />;
      })}
      {overflow > 0 && <OverflowChip count={overflow} />}
    </Fragment>
  );
}
