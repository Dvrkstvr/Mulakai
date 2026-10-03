import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const readTimings = vi.fn();
const jobStatus = vi.fn();
const lyricsHealth = vi.fn();
vi.mock('./api', () => ({
  api: {
    readTimings: (id: string) => readTimings(id),
    jobStatus: (id: string) => jobStatus(id),
    lyricsHealth: () => lyricsHealth(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const { useTimingsStore, resetTimingsHealth, shouldAutoRead } = await import('./timingsStore');
const { ApiError } = await import('./api');

const tick = () => vi.advanceTimersByTimeAsync(2000);
const run = (id = 'v1') => useTimingsStore.getState().runs[id];

beforeEach(() => {
  vi.useFakeTimers();
  useTimingsStore.setState({ runs: {}, configured: null });
  resetTimingsHealth();
  readTimings.mockReset().mockResolvedValue({ jobId: 'j1' });
  jobStatus.mockReset();
  lyricsHealth.mockReset();
});

afterEach(() => vi.useRealTimers());

describe('read', () => {
  it('runs until the job is done, then marks the version done', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'running' }).mockResolvedValueOnce({ status: 'done' });
    const done = useTimingsStore.getState().read('v1');
    await vi.advanceTimersByTimeAsync(0);
    expect(run()).toEqual({ stage: 'running', jobId: 'j1' });
    await tick();
    expect(run()?.stage).toBe('running');
    await tick();
    await done;
    expect(run()).toEqual({ stage: 'done' });
    expect(readTimings).toHaveBeenCalledWith('v1');
  });

  it('starts once per version while running', async () => {
    jobStatus.mockResolvedValue({ status: 'running' });
    void useTimingsStore.getState().read('v1');
    void useTimingsStore.getState().read('v1');
    await vi.advanceTimersByTimeAsync(0);
    expect(readTimings).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed job as failed, with its reason, until RETRY clears it', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'CUDA out of memory' });
    const done = useTimingsStore.getState().read('v1');
    await tick();
    await done;
    expect(run()).toEqual({ stage: 'failed', error: 'CUDA out of memory' });
    useTimingsStore.getState().retry('v1');
    expect(run()).toBeUndefined();
  });

  it('forgets the attempt when the lock was taken first (409), so the auto-read tries again', async () => {
    readTimings.mockRejectedValueOnce(new ApiError('a generation is already in progress', 409));
    await useTimingsStore.getState().read('v1');
    expect(run()).toBeUndefined();
  });

  it('fails on any other refusal', async () => {
    readTimings.mockRejectedValueOnce(new ApiError('word timings are not set up', 400));
    await useTimingsStore.getState().read('v1');
    expect(run()).toEqual({ stage: 'failed', error: 'word timings are not set up' });
  });

  it('rides out a transient poll error and forgets a job the server lost (404)', async () => {
    jobStatus.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError('unknown job', 404));
    const done = useTimingsStore.getState().read('v1');
    await tick();
    expect(run()?.stage).toBe('running');
    await tick();
    await done;
    expect(run()).toBeUndefined();
  });
});

describe('checkConfigured', () => {
  it('asks lyrics-server health once and remembers the answer', async () => {
    lyricsHealth.mockResolvedValue({ configured: true, ready: false });
    await useTimingsStore.getState().checkConfigured();
    await useTimingsStore.getState().checkConfigured();
    expect(useTimingsStore.getState().configured).toBe(true);
    expect(lyricsHealth).toHaveBeenCalledTimes(1);
  });

  it('asks again after the server could not be reached', async () => {
    lyricsHealth.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ configured: false, ready: false });
    await useTimingsStore.getState().checkConfigured();
    expect(useTimingsStore.getState().configured).toBeNull();
    await useTimingsStore.getState().checkConfigured();
    expect(useTimingsStore.getState().configured).toBe(false);
  });
});

describe('shouldAutoRead', () => {
  const ready = { configured: true, versionId: 'v1', hasTimings: false, hasWords: true, lockFree: true };

  it('reads an unread version with words once the service is set up and the lock is free', () => {
    expect(shouldAutoRead(ready)).toBe(true);
  });

  it.each([
    ['the service is not set up', { configured: false }],
    ['health has not answered yet', { configured: null }],
    ['there is no version', { versionId: undefined }],
    ['it was read already', { hasTimings: true }],
    ['the song has no words to time', { hasWords: false }],
    ['another job holds the lock', { lockFree: false }],
    ['a read is running', { run: { stage: 'running' as const } }],
    ['a read failed (RETRY clears it)', { run: { stage: 'failed' as const, error: 'x' } }],
  ])('waits when %s', (_why, change) => {
    expect(shouldAutoRead({ ...ready, ...change })).toBe(false);
  });
});
