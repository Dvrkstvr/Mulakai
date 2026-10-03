import type { ActivityEntry } from './activitySettle';

/** What a refused RETRY says on its FAILED row: its store follows one such job at a time
 * (TRANSCRIBE, READ LYRICS, word timings, or another layer's open split) and one is going. */
export const RETRY_BUSY = 'one is already going · try again once it finishes';

/** Activity's RETRY on a FAILED row. A busy GPU doesn't refuse it: the server queues the job
 * (PLAN.md "UI Redesign", S4.7). The row may only leave the list once its job has really
 * started again ('started'). */
export function retryEntry(entry: Pick<ActivityEntry, 'retry'>): 'started' | 'busy' {
  if (!entry.retry) return 'busy';
  return entry.retry() ? 'started' : 'busy';
}
