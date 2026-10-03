/**
 * FEELING LUCKY as a queued job (PLAN.md "UI Redesign", S4): ACE-Step's LM writes a random
 * sample, and the LM shares the card with whatever DiT job runs, so it waits its turn in
 * genQueue.ts like ANALYZE AUDIO instead of calling ACE-Step beside a running job. The client
 * polls the job; its `sample` carries the result.
 */
import crypto from 'node:crypto';
import { createRandomSample } from './acestep.js';
import { type Job, queueJob, wasAborted } from './jobs.js';

export type SampleType = 'simple_mode' | 'custom_mode';

/** Throws QueueFullError, before ACE-Step is called, when the queue is full. */
export function startSample(sampleType: SampleType): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'sample', label: 'feeling lucky' }, job, async () => {
    const sample = await createRandomSample(sampleType);
    if (wasAborted(job)) return; // ACE-Step has no cancel: an aborted sample is just dropped
    job.sample = sample;
    job.status = 'done';
  }, 'running');
}
