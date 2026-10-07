/**
 * Job settle events (C1, F-052): `jobRunner.queueJob` emits one `JobSettled` when a job's body
 * settles or it leaves the queue cancelled; the chat analysis trigger listens. A listener that
 * throws is logged and never fails the job or stops the other listeners.
 */
import type { GenKind } from './genQueue.js';
import type { Job } from './jobRegistry.js';

export interface JobSettled {
  jobId: string;
  kind: GenKind;
  status: Job['status'];
  /** The song the job worked on or made (poll() sets it for a first take), if known. */
  songId?: string;
  label?: string;
}

type Listener = (event: JobSettled) => void;
const listeners = new Set<Listener>();

/** Subscribes `listener`; returns the unsubscribe. */
export function onJobSettled(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitJobSettled(event: JobSettled): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (err) {
      console.error('jobSettled listener failed:', err);
    }
  }
}
