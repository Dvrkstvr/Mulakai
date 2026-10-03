/**
 * ANALYZE AUDIO as a queued job (PLAN.md "UI Redesign", S4 decision 2): ACE-Step loads a DiT
 * and the LM to describe a source, so it may not run next to any other job on a 16 GB card.
 * It was one synchronous request holding the lock; a request can't wait out a queue, so it is
 * now a polled Job like TRANSCRIBE, whose `analysis` carries the result. A timeout is
 * `call()`'s own leash (acestepTimeoutMs) rejecting, which fails the job and frees the slot.
 */
import crypto from 'node:crypto';
import { analyzeAudio } from './acestep.js';
import { type Job, queueJob, wasAborted } from './jobs.js';

/** Throws QueueFullError, before ACE-Step is called, when the queue is full. */
export function startAnalyze(file: { data: Buffer; filename: string }, model?: string): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'analyze', title: file.filename, label: 'describe the source' }, job, async () => {
    const analysis = await analyzeAudio(file, model);
    if (wasAborted(job)) return; // ACE-Step has no cancel: an aborted analysis is just dropped
    job.analysis = analysis;
    job.status = 'done';
  }, 'running');
}
