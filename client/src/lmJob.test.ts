/** Create's LM helpers wait their turn in the server's queue like every other job. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const jobStatus = vi.fn();
const cancelJob = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
const queue = vi.fn(async () => ({ running: null, queued: [] }));
vi.mock('./api', () => ({
  api: {
    jobStatus: (...a: unknown[]) => jobStatus(...a),
    cancelJob: (...a: unknown[]) => cancelJob(...a),
    queue: () => queue(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const { followLmJob, lmWaitNote, LM_POLL_MS } = await import('./lmJob');
const tick = () => vi.advanceTimersByTimeAsync(LM_POLL_MS);
const sample = { caption: 'an anime battle theme', lyrics: '[Verse 1]' };
const submit = vi.fn(async () => ({ jobId: 'lm1' }));

beforeEach(() => {
  vi.useFakeTimers();
  submit.mockClear();
  jobStatus.mockReset();
  cancelJob.mockClear();
  queue.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('followLmJob', () => {
  it('reports its place in line, then resolves with what the LM wrote', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'queued', queuePosition: 2 })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'done', sample });
    const waits: (number | null)[] = [];
    const result = followLmJob(submit, (p) => waits.push(p));
    await tick();
    await tick();
    await tick();
    expect(await result).toEqual(sample);
    expect(waits).toEqual([2, null]);
    expect(queue).toHaveBeenCalled(); // the next commit's "starts after N jobs" counts it
  });

  it('resolves null once cancelled from UP NEXT', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'cancelled', cancelled: true });
    const result = followLmJob(submit);
    await tick();
    expect(await result).toBeNull();
  });

  it('stops following, and takes the job out of the queue, once nothing wants it', async () => {
    const result = followLmJob(submit, undefined, () => false);
    await tick();
    expect(await result).toBeNull();
    expect(jobStatus).not.toHaveBeenCalled();
    expect(cancelJob).toHaveBeenCalledWith('lm1');
  });

  it("throws the job's error, and a full queue's reason from the submit", async () => {
    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'LLM not initialized' });
    const failed = followLmJob(submit).catch((e: Error) => e.message);
    await tick();
    expect(await failed).toBe('LLM not initialized');

    const full = vi.fn(async () => { throw new Error('the queue is full (10 jobs waiting) — cancel one or wait for one to finish'); });
    await expect(followLmJob(full)).rejects.toThrow('the queue is full');
  });
});

describe('lmWaitNote', () => {
  it('says when a waiting helper starts, and nothing once it runs', () => {
    expect(lmWaitNote('QUICK START', 1)).toBe('QUICK START waits its turn · starts after 1 job');
    expect(lmWaitNote('WRITE FOR ME', 3)).toBe('WRITE FOR ME waits its turn · starts after 3 jobs');
    expect(lmWaitNote('FEELING LUCKY', null)).toBeNull();
  });
});
