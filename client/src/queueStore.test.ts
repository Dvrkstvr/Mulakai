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

  it('a CANCEL refused because the job just started keeps the row, says so, and lets the poll move it', async () => {
    await useQueueStore.getState().poll();
    const started = "it already started — it's running now; ABORT it from RUNNING to stop it";
    cancelJob.mockRejectedValueOnce(new Error(started));
    queue.mockResolvedValueOnce({ running: { ...RUNNING, jobId: 'a' }, queued: [entry('b', 1)] });
    await useQueueStore.getState().cancel('a');
    expect(useQueueStore.getState().error).toBe(started);
    await vi.waitFor(() => expect(useQueueStore.getState().running?.jobId).toBe('a'));
    expect(useQueueStore.getState().queued.map((q) => q.jobId)).toEqual(['b']);
  });
});
