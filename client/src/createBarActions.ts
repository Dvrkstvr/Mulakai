/** What a create bar chip's confirm does, through the stores that already own each action. */
import { useApiStatusStore } from './apiStatusStore';
import { useCreateDraftStore } from './createDraftStore';
import type { GenAction } from './createBarStatus';
import { useQueueStore } from './queueStore';
import { useQuickStartStore } from './quickStartStore';
import { useVoiceStore } from './voiceStore';

export type ChipTarget = { kind: 'draft' } | { kind: 'stop' } | { kind: GenAction; jobId: string };

/** The key a chip's confirm state is held under, so one chip confirms at a time. */
export const targetKey = (t: ChipTarget): string => ('jobId' in t ? `${t.kind}:${t.jobId}` : t.kind);

export function confirmChip(t: ChipTarget): Promise<void> {
  if (t.kind === 'draft') {
    // The same pair CLEAR DRAFT runs: the reference audio lives in its own store.
    useCreateDraftStore.getState().clear();
    useVoiceStore.getState().clearReference();
    return Promise.resolve();
  }
  if (t.kind === 'stop') {
    useQuickStartStore.getState().stop();
    return Promise.resolve();
  }
  if (t.kind === 'cancel') return useQueueStore.getState().cancel(t.jobId);
  return useApiStatusStore.getState().abort();
}
