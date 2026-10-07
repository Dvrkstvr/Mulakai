import { isCreateBusy, thinkChip } from './createBarStatus';
import { isDraftEmpty, useCreateDraftStore } from './createDraftStore';
import { useQuickStartStore } from './quickStartStore';

/** The thinking chip, if any, and whether Create is busy with an idea (createBarStatus.ts). */
export function useCreateBusy() {
  const draftEmpty = useCreateDraftStore(isDraftEmpty);
  const pendingQuery = useCreateDraftStore((s) => s.pendingQuery);
  const think = thinkChip(useQuickStartStore(), pendingQuery);
  return { think, draftEmpty, busy: isCreateBusy(draftEmpty, think) };
}
