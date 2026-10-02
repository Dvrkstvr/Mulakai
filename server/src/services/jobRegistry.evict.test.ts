import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { registerJob, getJob, evictIdleJobs, isLiveResultPath, JOB_IDLE_TTL_MS } = await import('./jobRegistry.js');
type Job = import('./jobRegistry.js').Job;

function newJob(status: Job['status'], extra: Partial<Job> = {}): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: 't', status, createdAt: Date.now(), ...extra };
  registerJob(job);
  return job;
}

/** Read the job the way a client poll does, at time `at`. */
function pollAt(id: string, at: number): void {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(at);
  getJob(id);
  clock.mockRestore();
}

describe('evictIdleJobs', () => {
  it('drops settled jobs unread for the TTL, and keeps fresher ones', async () => {
    const done = newJob('done');
    const failed = newJob('failed', { error: 'Aborted' });
    const fresh = newJob('done');
    const later = fresh.lastSeenAt! + JOB_IDLE_TTL_MS + 1;
    pollAt(fresh.id, later - 1000);

    await evictIdleJobs(later);

    expect(getJob(done.id)).toBeUndefined();
    expect(getJob(failed.id)).toBeUndefined();
    expect(getJob(fresh.id)).toBe(fresh);
  });

  it('never evicts a running or loading job, however long nobody has polled it', async () => {
    const running = newJob('running');
    const loading = newJob('loading');

    await evictIdleJobs(Date.now() + 10 * JOB_IDLE_TTL_MS);

    expect(getJob(running.id)).toBe(running);
    expect(getJob(loading.id)).toBe(loading);
  });

  it('deletes a remaster result nobody downloaded along with its job', async () => {
    const resultPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-')), 'remaster.flac');
    fs.writeFileSync(resultPath, 'remaster');
    const job = newJob('done', { resultPath });
    expect(isLiveResultPath(resultPath)).toBe(true);

    await evictIdleJobs(job.lastSeenAt! + JOB_IDLE_TTL_MS + 1);

    expect(getJob(job.id)).toBeUndefined();
    expect(fs.existsSync(resultPath)).toBe(false);
    expect(isLiveResultPath(resultPath)).toBe(false);
  });
});
