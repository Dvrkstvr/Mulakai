/**
 * ANALYZE AUDIO under the genLock (PLAN.md "ANALYZE AUDIO Takes the genLock"): ACE-Step
 * loads a DiT and the LM to describe a source, so it may not run next to any other job on a
 * 16 GB card. The call is synchronous, so the request itself is the job: no Job record, and
 * the lock lives exactly as long as the call. A timeout is `call()`'s own leash
 * (acestepTimeoutMs) rejecting, so it releases through the same `finally`.
 */
import crypto from 'node:crypto';
import { analyzeAudio, type FormatInputResult } from './acestep.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';

/** Rejects with GenLockError, before ACE-Step is called, if another job holds the lock. */
export async function analyzeUnderLock(
  file: { data: Buffer; filename: string },
  model?: string,
): Promise<FormatInputResult> {
  const jobId = crypto.randomUUID();
  acquireGenLock({ kind: 'analyze', jobId, title: file.filename });
  try {
    return await analyzeAudio(file, model);
  } finally {
    releaseGenLock(jobId);
  }
}
