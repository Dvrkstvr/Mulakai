/** FEELING LUCKY waits its turn in the queue instead of calling ACE-Step's LM beside a running job. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-sample-test-'));

const createRandomSample = vi.fn();
vi.mock('./acestep.js', () => ({ createRandomSample: (...a: unknown[]) => createRandomSample(...a) }));

const { startSample } = await import('./sampleJobs.js');
const { enqueue, getRunning, QUEUE_LIMIT, QueueFullError } = await import('./genQueue.js');
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

describe('startSample', () => {
  it('waits behind a running job, then carries the LM sample', async () => {
    const sample = { caption: 'an anime battle theme', lyrics: '[Verse 1]' };
    createRandomSample.mockResolvedValueOnce(sample);
    const release = holdSlot();
    const job = startSample('custom_mode');
    expect(job.status).toBe('queued');
    expect(createRandomSample).not.toHaveBeenCalled();

    release();
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('done'));
    expect(createRandomSample).toHaveBeenCalledWith('custom_mode');
    expect(getJob(job.id)?.sample).toEqual(sample);
  });

  it('fails the job with ACE-Step\'s error and frees the slot', async () => {
    createRandomSample.mockRejectedValueOnce(new Error('LLM not initialized'));
    const job = startSample('simple_mode');
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('failed'));
    expect(getJob(job.id)?.error).toBe('LLM not initialized');
  });

  it('is refused before ACE-Step is called when the queue is full', () => {
    createRandomSample.mockClear();
    const release = holdSlot();
    const releases = Array.from({ length: QUEUE_LIMIT }, () => holdSlot());
    expect(() => startSample('simple_mode')).toThrow(QueueFullError);
    expect(createRandomSample).not.toHaveBeenCalled();
    release();
    releases.forEach((r) => r());
  });
});
