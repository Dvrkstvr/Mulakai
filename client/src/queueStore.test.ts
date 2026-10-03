import { describe, it, expect, beforeEach, vi } from 'vitest';

const queue = vi.fn();
const cancelJob = vi.fn();
vi.mock('./api', () => ({
  api: { queue: () => queue(), cancelJob: (id: string) => cancelJob(id) },
}));

const { useQueueStore } = await import('./queueStore');

const entry = (jobId: string, position: number) => ({ kind: 'repaint' as const, jobId, position, queuedAt: 1 });
const RUNNING = { kind: 'generate' as const, jobId: 'r', startedAt: 1 };

beforeEach(() => {
  useQueueStore.setState({ running: null, queued: [], cancelling: [], error: null });
  queue.mockReset().mockResolvedValue({ running: RUNNING, queued: [entry('a', 1), entry('b', 2)] });
  cancelJob.mockReset().mockResolvedValue({ ok: true, cancelled: true });
});

describe('queueStore', () => {
  it('mirrors the server queue, and keeps the last snapshot through a failed poll', async () => {
    await useQueueStore.getState().poll();
    expect(useQueueStore.getState()).toMatchObject({ running: RUNNING, queued: [entry('a', 1), entry('b', 2)] });
    queue.mockRejectedValueOnce(new Error('network'));
    await useQueueStore.getState().poll();
    expect(useQueueStore.getState().queued).toHaveLength(2);
  });

  it('CANCEL takes the row out at once, then re-reads the queue', async () => {
    await useQueueStore.getState().poll();
    queue.mockResolvedValueOnce({ running: RUNNING, queued: [entry('b', 1)] });
    const done = useQueueStore.getState().cancel('a');
    expect(useQueueStore.getState().cancelling).toEqual(['a']);
    await useQueueStore.getState().cancel('a'); // a second press while in flight does nothing
    await done;
    expect(cancelJob).toHaveBeenCalledTimes(1);
    expect(cancelJob).toHaveBeenCalledWith('a');
    await vi.waitFor(() => expect(useQueueStore.getState().queued).toEqual([entry('b', 1)]));
    expect(useQueueStore.getState().cancelling).toEqual([]);
  });

  it('says why a CANCEL failed and keeps the row', async () => {
    await useQueueStore.getState().poll();
    cancelJob.mockRejectedValueOnce(new Error('this job is neither queued nor running'));
    await useQueueStore.getState().cancel('a');
    expect(useQueueStore.getState().error).toBe('this job is neither queued nor running');
    expect(useQueueStore.getState().queued.map((q) => q.jobId)).toEqual(['a', 'b']);
  });
});
