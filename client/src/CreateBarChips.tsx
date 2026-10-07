import { Fragment, useState } from 'react';
import { useApiStatusStore } from './apiStatusStore';
import { confirmChip, targetKey, type ChipTarget } from './createBarActions';
import { abortableGenKeys, CONFIRM_COPY, draftChipText, genChips, type GenChip } from './createBarStatus';
import { ChipConfirm, DraftChip, GenerationChip, OverflowChip } from './CreateBarChip';
import { isDraftEmpty, useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useQueueStore } from './queueStore';
import { useRunningRows } from './useRunningRows';
import './createBarChips.css';

type GenTarget = Extract<ChipTarget, { jobId: string }>;
const genTarget = (c: GenChip): GenTarget | null => (c.action ? { kind: c.action, jobId: c.jobId } : null);

/** Status chips between FEELING LUCKY and the input (PLAN.md "Create Bar Status Chips"): the song
 * generations in flight and Create's draft, each with one quick action confirmed in place. */
export function CreateBarChips({ onResume }: { onResume: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const jobs = useGenerationStore((s) => s.jobs);
  const rows = useRunningRows();
  const cancelling = useQueueStore((s) => s.cancelling);
  const aborting = useApiStatusStore((s) => s.aborting);
  const draftEmpty = useCreateDraftStore(isDraftEmpty);
  const draftText = useCreateDraftStore((s) => draftChipText(s));

  const { chips, overflow } = genChips(jobs, abortableGenKeys(rows));
  const keep = () => setConfirming(null);
  const confirm = (t: ChipTarget) => { setConfirming(null); void confirmChip(t); };
  // Derived: a chip whose job settled, or a draft emptied elsewhere, drops its confirm.
  const asking = (t: ChipTarget | null) => !!t && confirming === targetKey(t);

  return (
    <Fragment>
      {chips.map((c) => {
        const t = genTarget(c);
        if (t && asking(t)) return <ChipConfirm key={c.key} copy={CONFIRM_COPY[t.kind]} onConfirm={() => confirm(t)} onKeep={keep} />;
        const busy = c.action === 'cancel' ? cancelling.includes(c.jobId) : c.action === 'abort' && aborting;
        return <GenerationChip key={c.key} chip={c} busy={busy} onAsk={() => t && setConfirming(targetKey(t))} />;
      })}
      {overflow > 0 && <OverflowChip count={overflow} />}
      {!draftEmpty && (asking({ kind: 'draft' })
        ? <ChipConfirm copy={CONFIRM_COPY.clear} onConfirm={() => confirm({ kind: 'draft' })} onKeep={keep} />
        : <DraftChip text={draftText} onResume={onResume} onAskClear={() => setConfirming('draft')} />)}
    </Fragment>
  );
}
