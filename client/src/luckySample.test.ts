/** FEELING LUCKY waits its turn in the server's queue like every other job. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const randomSample = vi.fn();
const jobStatus = vi.fn();
const queue = vi.fn(async () => ({ running: null, queued: [] }));
vi.mock('./api', () => ({
  api: {
    randomSample: (...a: unknown[]) => randomSample(...a),
    jobStatus: (...a: unknown[]) => jobStatus(...a),
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

const { rollSample, SAMPLE_POLL_MS } = await import('./luckySample');
const { startsAfter } = await import('./queueCopy');
const tick = () => vi.advanceTimersByTimeAsync(SAMPLE_POLL_MS);
const sample = { caption: 'an anime battle theme', lyrics: '[Verse 1]' };

beforeEach(() => {
  vi.useFakeTimers();
  randomSample.mockReset().mockResolvedValue({ jobId: 's1' });
  jobStatus.mockReset();
  queue.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('rollSample', () => {
  it('submits a queued job, reports its place in line, and resolves with the sample', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'queued', queuePosition: 2 })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'done', sample });
    const waits: (number | null)[] = [];
    const result = rollSample((p) => waits.push(p));
    await tick();
    await tick();
    await tick();
    expect(await result).toEqual(sample);
    expect(waits).toEqual([2, null]);
    expect(randomSample).toHaveBeenCalledWith('custom_mode');
    expect(queue).toHaveBeenCalled(); // the next commit's "starts after N jobs" counts it
    expect(startsAfter(2)).toBe('starts after 2 jobs');
  });

  it('resolves null once cancelled from UP NEXT', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'cancelled', cancelled: true });
    const result = rollSample();
    await tick();
    expect(await result).toBeNull();
  });

  it("throws the job's error, and a full queue's reason from the submit", async () => {
    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'LLM not initialized' });
    const failed = rollSample().catch((e: Error) => e.message);
    await tick();
    expect(await failed).toBe('LLM not initialized');

    randomSample.mockRejectedValueOnce(new Error('the queue is full (10 jobs waiting) — cancel one or wait for one to finish'));
    await expect(rollSample()).rejects.toThrow('the queue is full');
  });
});
