/** Queue slice (PLAN.md "UI Redesign", S4): the server's GPU job queue — what runs, what waits
 * behind it, and CANCEL for a waiting job. Every job still polls through `jobStatus`. */
import { json } from './http';
import type { ActiveGeneration } from './types';

export interface QueueRunning {
  kind: ActiveGeneration['kind'];
  jobId: string;
  songId?: string;
  title?: string;
  /** The layer an edit works on, by name. */
  layer?: string;
  /** What the job does, in a few words ("repaint 1:32–2:07"). */
  label?: string;
  task?: string;
  engine?: string;
  startedAt: number;
}

export interface QueueEntry extends Omit<QueueRunning, 'startedAt'> {
  /** 1 = next to run. */
  position: number;
  queuedAt: number;
}

export interface QueueSnapshot {
  running: QueueRunning | null;
  queued: QueueEntry[];
}

export const queueApi = {
  queue: (): Promise<QueueSnapshot> => fetch('/api/generate/queue').then((r) => json<QueueSnapshot>(r)),

  /** A queued job leaves the line (its poll then reads failed + `cancelled`); the running one
   * gets the best-effort ABORT. */
  cancelJob: (jobId: string): Promise<{ ok: boolean; cancelled?: boolean; aborted?: boolean }> =>
    fetch(`/api/generate/${jobId}/cancel`, { method: 'POST' }).then((r) => json(r)),
};
