import type { QueueEntry } from './api';
import { useQueueStore } from './queueStore';
import { queuedLine, queuedTitle } from './queueCopy';

/** UP NEXT (PLAN.md "UI Redesign", S4.7): a plain dashed card per job waiting in the server's
 * queue — no AI shader, since nothing is working on it yet — with CANCEL, a quiet outline. */
export function QueuedActivityRow({ entry, songTitle }: { entry: QueueEntry; songTitle?: string }) {
  const cancel = useQueueStore((s) => s.cancel);
  const cancelling = useQueueStore((s) => s.cancelling.includes(entry.jobId));
  return (
    <div className="activity-job queued">
      <div className="activity-job-head">
        <span className="activity-title">{queuedTitle(entry, songTitle)}</span>
        <button
          type="button" className="activity-quiet" disabled={cancelling}
          title="Takes it out of the queue · nothing has been made yet, so nothing is lost"
          onClick={() => void cancel(entry.jobId)}
        >
          <span>{cancelling ? 'CANCELLING…' : 'CANCEL'}</span>
        </button>
      </div>
      <span className="activity-detail">{queuedLine(entry)}</span>
    </div>
  );
}
