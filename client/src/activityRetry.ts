import type { ActivityEntry } from './activitySettle';

/** What a refused RETRY says on its FAILED row: one job holds the server's lock at a time, and
 * the owning store won't start a second one. */
export const RETRY_BUSY = 'another job is running · try again once it finishes';

/** Activity's RETRY on a FAILED row. `busy` is whether anything is running now; the row may only
 * leave the list once its job has really started again ('started'). */
export function retryEntry(entry: Pick<ActivityEntry, 'retry'>, busy: boolean): 'started' | 'busy' {
  if (busy || !entry.retry) return 'busy';
  return entry.retry() ? 'started' : 'busy';
}
