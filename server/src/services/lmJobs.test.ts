/** The LM helpers wait their turn in the queue instead of calling ACE-Step beside a running job. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-lm-test-'));

const { startLmJob } = await import('./lmJobs.js');
const { enqueue, getQueued, getRunning, QUEUE_LIMIT, QueueFullError } = await import('./genQueue.js');
const { getJob } = await import('./jobs.js');

afterEach(async () => {
  await vi.waitFor(() => expect(getRunning()).toBeNull());
});

/** Holds the queue's slot with a job of another kind until `release` is called. */
function holdSlot(): () => void {
  let release = () => {};
  const done = new Promise<void>((r) => { release = r; });
  enqueue({ kind: 'generate', jobId: `held-${Math.random()}` }, () => done, () => {});
  return release;
}

describe('startLmJob', () => {
  it('waits behind a running job, named for UP NEXT, then carries what the LM wrote', async () => {
    const sample = { caption: 'an anime battle theme', lyrics: '[Verse 1]' };
    const write = vi.fn(async () => sample);
    const release = holdSlot();
    const job = startLmJob('quick start', write);
    expect(job.status).toBe('queued');
    expect(getQueued()).toMatchObject([{ kind: 'lm', label: 'quick start', jobId: job.id }]);
    expect(write).not.toHaveBeenCalled();

    release();
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('done'));
    expect(write).toHaveBeenCalledOnce();
    expect(getJob(job.id)?.sample).toEqual(sample);
  });

  it("fails the job with ACE-Step's error and frees the slot", async () => {
    const job = startLmJob('write for me', async () => { throw new Error('LLM not initialized'); });
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('failed'));
    expect(getJob(job.id)?.error).toBe('LLM not initialized');
  });

  it('is refused before ACE-Step is called when the queue is full', () => {
    const write = vi.fn(async () => ({ caption: '', lyrics: '' }));
    const release = holdSlot();
    const releases = Array.from({ length: QUEUE_LIMIT }, () => holdSlot());
    expect(() => startLmJob('feeling lucky', write)).toThrow(QueueFullError);
    expect(write).not.toHaveBeenCalled();
    release();
    releases.forEach((r) => r());
  });
});
