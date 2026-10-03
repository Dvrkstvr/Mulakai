/**
 * ACE-Step's LM helpers as queued jobs (PLAN.md "UI Redesign", S4): FEELING LUCKY (a random
 * sample), Quick Start (a sample from a typed idea) and WRITE FOR ME (format the draft). The LM
 * shares the card with whatever DiT job runs, so each waits its turn in genQueue.ts like ANALYZE
 * AUDIO instead of calling ACE-Step beside a running job. The client polls the job; its
 * `sample` carries what the LM wrote.
 */
import crypto from 'node:crypto';
import type { SampleResult } from './acestep.js';
import { type Job, queueJob, wasAborted } from './jobs.js';

/** What the job does, as Activity's UP NEXT names it. */
export type LmLabel = 'feeling lucky' | 'quick start' | 'write for me';

/** Queues `write` (one LM call). Throws QueueFullError, before ACE-Step is called, when the
 * queue is full. */
export function startLmJob(label: LmLabel, write: () => Promise<SampleResult>): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'lm', label }, job, async () => {
    const sample = await write();
    if (wasAborted(job)) return; // ACE-Step has no cancel: an aborted call's result is just dropped
    job.sample = sample;
    job.status = 'done';
  }, 'running');
}
