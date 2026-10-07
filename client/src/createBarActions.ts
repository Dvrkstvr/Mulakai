/** What a create bar chip's confirm does, through the stores that already own each action. */
import { useApiStatusStore } from './apiStatusStore';
import type { GenAction } from './createBarStatus';
import { useQueueStore } from './queueStore';

export type ChipTarget = { kind: GenAction; jobId: string };

/** The key a chip's confirm state is held under, so one chip confirms at a time. */
export const targetKey = (t: ChipTarget): string => `${t.kind}:${t.jobId}`;

export function confirmChip(t: ChipTarget): Promise<void> {
  if (t.kind === 'cancel') return useQueueStore.getState().cancel(t.jobId);
  return useApiStatusStore.getState().abort();
}
