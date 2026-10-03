import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const repaint = vi.fn();
const retakeVersion = vi.fn();
const jobStatus = vi.fn();
vi.mock('./api', () => ({
  api: {
    repaint: (...args: unknown[]) => repaint(...args),
    retakeVersion: (id: string) => retakeVersion(id),
    jobStatus: (id: string) => jobStatus(id),
    queue: async () => ({ running: null, queued: [] }),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const { useEditorJobStore, isEditorBusy, myEditorJobs, jobView } = await import('./editorJobStore');
const { ApiError } = await import('./api');
const { JOB_GONE } = await import('./jobGone');

const POLL_MS = 2000;
const params = { prompt: 'p', start: 0, end: 1 };
const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);
const jobs = () => useEditorJobStore.getState().editorJobs;

beforeEach(() => {
  vi.useFakeTimers();
  useEditorJobStore.setState({ editorJobs: [], splitJob: null });
  repaint.mockReset().mockResolvedValue({ jobId: 'j1' });
  retakeVersion.mockReset().mockResolvedValue({ jobId: 'j2' });
  jobStatus.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runSingleJob polling', () => {
  it('keeps polling after a progress tick replaces the store object, until done', async () => {
    jobStatus
      .mockResolvedValueOnce({ status: 'running', progress: 0.4 })
      .mockResolvedValueOnce({ status: 'running', progress: 0.8 })
      .mockResolvedValueOnce({ status: 'done' });

    await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    await tick();
    expect(jobs()[0]).toMatchObject({ stage: 'running', progress: 0.4 });

    // Regression: the progress update above replaces the job object with a fresh spread; the
    // loop must find it again by its key and poll again.
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(2);
    expect(jobs()[0]).toMatchObject({ stage: 'running', progress: 0.8 });

    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(3);
    expect(jobs()[0]).toMatchObject({ stage: 'done' });
  });

  it('marks the job failed when the server reports failure', async () => {
    jobStatus
      .mockResolvedValueOnce({ status: 'running', progress: 0.2 })
      .mockResolvedValueOnce({ status: 'failed', error: 'boom' });

    await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    await tick();
    await tick();
    expect(jobs()[0]).toMatchObject({ stage: 'failed', error: 'boom' });
  });

  it('fails the job once the server no longer has it, instead of polling a 404 forever', async () => {
    jobStatus.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError('unknown job', 404));
    await useEditorJobStore.getState().startRepaint('l1', 's1', params);

    await tick();
    expect(jobs()[0]).toMatchObject({ stage: 'running' }); // a network error is retried
    await tick();
    expect(jobs()[0]).toMatchObject({ stage: 'failed', error: JOB_GONE });
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(2);
  });

  it('stops polling once dismissed', async () => {
    jobStatus.mockResolvedValue({ status: 'running', progress: 0.1 });

    const key = await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    await tick();
    useEditorJobStore.getState().dismiss(key);
    await tick();
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(1);
    expect(jobs()).toEqual([]);
  });
});

describe('several editor jobs at once (PLAN.md "UI Redesign", S4.7)', () => {
  it('starts a second job while the first is in flight, following each by its own id', async () => {
    repaint.mockResolvedValueOnce({ jobId: 'r1' }).mockResolvedValueOnce({ jobId: 'r2' });
    jobStatus.mockImplementation(async (id: string) => (id === 'r1'
      ? { status: 'running', progress: 0.5 } : { status: 'queued', queuePosition: 1 }));
    await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    await useEditorJobStore.getState().startRepaint('l1', 's1', { ...params, start: 4, end: 9 });
    await useEditorJobStore.getState().startRetake('l2', 's1', 'v1');
    expect(repaint).toHaveBeenCalledTimes(2);
    expect(retakeVersion).toHaveBeenCalledWith('v1');

    await tick();
    expect(jobs()).toMatchObject([
      { kind: 'repaint', jobId: 'r1', progress: 0.5, queuePosition: undefined },
      { kind: 'repaint', jobId: 'r2', queuePosition: 1 },
      { kind: 'retake', jobId: 'j2', queuePosition: 1 },
    ]);
    const view = jobView(myEditorJobs(jobs(), 'repaint', { layerId: 'l1' }));
    expect(view.inFlight.map((j) => j.jobId)).toEqual(['r1', 'r2']);
    expect(view.running?.jobId).toBe('r1');
  });

  it('keeps a failed job until it is dismissed or retried, beside running ones', async () => {
    repaint.mockRejectedValueOnce(new Error('the queue is full (10 jobs waiting) — cancel one or wait for one to finish'));
    const failedKey = await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    jobStatus.mockResolvedValue({ status: 'running' });
    await useEditorJobStore.getState().startRetake('l2', 's1', 'v1');
    expect(jobs().map((j) => [j.kind, j.stage])).toEqual([['repaint', 'failed'], ['retake', 'running']]);
    expect(jobView(jobs()).failed?.key).toBe(failedKey);
    expect(jobs()[0].error).toContain('the queue is full');
  });
});

describe('a failed editor job', () => {
  it('is not busy; running and done (during its linger) are', () => {
    const job = { kind: 'remaster', key: 'k', jobId: 'j', songId: 's', startedAt: 0 } as const;
    expect(isEditorBusy(null)).toBe(false);
    expect(isEditorBusy({ ...job, stage: 'failed' })).toBe(false);
    expect(isEditorBusy({ ...job, stage: 'running' })).toBe(true);
    expect(isEditorBusy({ ...job, stage: 'done' })).toBe(true);
  });

  async function failedRepaint() {
    repaint.mockRejectedValueOnce(new Error('CUDA out of memory'));
    await useEditorJobStore.getState().startRepaint('l1', 's1', params);
    const failed = jobs()[0];
    expect(failed).toMatchObject({ stage: 'failed', error: 'CUDA out of memory' });
    return failed;
  }

  it('retries with the same arguments (Activity RETRY), replacing the failed one', async () => {
    jobStatus.mockResolvedValue({ status: 'running' });
    const failed = await failedRepaint();
    expect(failed.retry?.()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(repaint).toHaveBeenCalledTimes(2);
    expect(repaint).toHaveBeenLastCalledWith('l1', params);
    expect(jobs()).toMatchObject([{ kind: 'repaint', stage: 'running', jobId: 'j1' }]);
  });

  it('retries even while another editor job runs: the server queues it', async () => {
    jobStatus.mockResolvedValue({ status: 'running' });
    const failed = await failedRepaint();
    await useEditorJobStore.getState().startRetake('l2', 's1', 'v1');
    expect(failed.retry?.()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(repaint).toHaveBeenCalledTimes(2);
    expect(jobs().map((j) => [j.kind, j.stage])).toEqual([['retake', 'running'], ['repaint', 'running']]);
  });
});
