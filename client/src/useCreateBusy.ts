import { isCreateBusy, liveGenJobs, thinkChip } from './createBarStatus';
import { isDraftEmpty, useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useQuickStartStore } from './quickStartStore';

/** What Create is doing, for the Library's create bar (createBarStatus.ts): Quick Start's card if
 * it is writing, the generations in flight, and whether the bar shows the Create card at all. */
export function useCreateBusy() {
  const draftEmpty = useCreateDraftStore(isDraftEmpty);
  const pendingQuery = useCreateDraftStore((s) => s.pendingQuery);
  const think = thinkChip(useQuickStartStore(), pendingQuery);
  const live = liveGenJobs(useGenerationStore((s) => s.jobs));
  return { think, live, draftEmpty, busy: isCreateBusy(draftEmpty, think, live.length > 0) };
}
