import { useState } from 'react';
import { api, type Layer, type StemKind } from './api';
import { useEditorJobStore } from './editorJobStore';
import { fmtElapsed, useElapsedMs } from './genProgress';
import { startsAfter } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { previewPlayback } from './previewPlayback';

/**
 * A layer's open SPLIT session (PLAN.md "Editor Redesign", PR 9): its stems and what can be done with them — keep one
 * as a layer, use one as this layer's take, re-extract one or all, close and discard the rest. The session itself lives
 * in editorJobStore.ts's `splitJob` slot, so leaving the Editor and coming back reconnects to the same stems.
 */
export function useSplitSession(layer: Layer, onChanged: () => Promise<void>) {
  const [error, setError] = useState('');
  const [busyKind, setBusyKind] = useState<StemKind | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const ahead = useJobsAhead();
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const cancelSplitJob = useEditorJobStore((s) => s.cancelSplit);
  const patchSplitStem = useEditorJobStore((s) => s.patchSplitStem);
  const mine = splitJob?.layerId === layer.id ? splitJob : null;
  const stems = mine && mine.stage !== 'failed' ? mine.stems : null;
  const extracting = mine?.stage === 'running';
  const elapsedMs = useElapsedMs(extracting && !mine?.queuePosition, mine?.startedAt ?? null);
  const status = !extracting ? null : mine?.queuePosition ? `queued · ${startsAfter(mine.queuePosition)}` : `${fmtElapsed(elapsedMs)} elapsed`;

  const run = async (busy: (on: boolean) => void, work: () => Promise<void>) => {
    busy(true);
    setError('');
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { busy(false); }
  };
  const byKind = (kind: StemKind) => (on: boolean) => setBusyKind(on ? kind : null);

  return {
    stems, status, error, ahead, busyKind, busyAll,
    failed: mine?.stage === 'failed' ? mine.error ?? 'split failed' : null,
    claim: (kind: StemKind, action: 'replace' | 'add-layer') => run(byKind(kind), async () => {
      const current = mine?.stems.find((s) => s.kind === kind);
      if (!mine || !current) return;
      await api.claimStem(mine.splitJobId, kind, action);
      await onChanged();
      patchSplitStem({ ...current, claimed: action === 'replace' ? 'replaced' : 'added' });
    }),
    reextract: (kind: StemKind) => run(byKind(kind), async () => {
      if (mine) patchSplitStem(await api.reextractStem(mine.splitJobId, kind));
    }),
    splitAgain: () => run(setBusyAll, async () => {
      if (mine) (await api.reextractAllStems(mine.splitJobId)).stems.forEach(patchSplitStem);
    }),
    close: async () => {
      previewPlayback.stop();
      setError('');
      await cancelSplitJob();
    },
  };
}
