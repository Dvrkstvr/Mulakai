import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const repaint = vi.fn();
const retakeVersion = vi.fn();
const jobStatus = vi.fn();
vi.mock('./api', () => ({
  api: {
    repaint: (...args: unknown[]) => repaint(...args),
    retakeVersion: (id: string) => retakeVersion(id),
    jobStatus: (id: string) => jobStatus(id),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const { useEditorJobStore, isEditorBusy } = await import('./editorJobStore');
const { ApiError } = await import('./api');
const { JOB_GONE } = await import('./jobGone');

const POLL_MS = 2000;

const tick = () => vi.advanceTimersByTimeAsync(POLL_MS);

describe('runSingleJob polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorJobStore.setState({ editorJob: null });
    repaint.mockReset().mockResolvedValue({ jobId: 'j1' });
    jobStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps polling after a progress tick replaces the store object, until done', async () => {
    jobStatus
      .mockResolvedValueOnce({ status: 'running', progress: 0.4 })
      .mockResolvedValueOnce({ status: 'running', progress: 0.8 })
      .mockResolvedValueOnce({ status: 'done' });

    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    await vi.advanceTimersByTimeAsync(0); // let submit() resolve

    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'running', progress: 0.4 });

    // Regression: the progress update above replaces the store object with a fresh
    // spread; the loop guard must survive that and poll again.
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(2);
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'running', progress: 0.8 });

    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(3);
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'done' });
  });

  it('marks the job failed when the server reports failure', async () => {
    jobStatus
      .mockResolvedValueOnce({ status: 'running', progress: 0.2 })
      .mockResolvedValueOnce({ status: 'failed', error: 'boom' });

    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    await vi.advanceTimersByTimeAsync(0);

    await tick();
    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'failed', error: 'boom' });
  });

  it('fails the job once the server no longer has it, instead of polling a 404 forever', async () => {
    jobStatus.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError('unknown job', 404));
    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    await vi.advanceTimersByTimeAsync(0);

    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'running' }); // a network error is retried
    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'failed', error: JOB_GONE });
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(2);
  });

  it('stops polling once dismissed', async () => {
    jobStatus.mockResolvedValue({ status: 'running', progress: 0.1 });

    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    await vi.advanceTimersByTimeAsync(0);

    await tick();
    useEditorJobStore.getState().dismiss();
    await tick();
    await tick();
    expect(jobStatus).toHaveBeenCalledTimes(1);
    expect(useEditorJobStore.getState().editorJob).toBeNull();
  });
});

describe('a failed editor job', () => {
  it('is not busy; running and done (during its linger) are', () => {
    const job = { kind: 'remaster', jobId: 'j', songId: 's', startedAt: 0 } as const;
    expect(isEditorBusy(null)).toBe(false);
    expect(isEditorBusy({ ...job, stage: 'failed' })).toBe(false);
    expect(isEditorBusy({ ...job, stage: 'running' })).toBe(true);
    expect(isEditorBusy({ ...job, stage: 'done' })).toBe(true);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useEditorJobStore.setState({ editorJob: null });
    repaint.mockReset().mockResolvedValue({ jobId: 'j1' });
    retakeVersion.mockReset().mockResolvedValue({ jobId: 'j2' });
    jobStatus.mockReset().mockResolvedValue({ status: 'running' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a start of another kind replace it', async () => {
    repaint.mockRejectedValueOnce(new Error('ACE-Step down'));
    await useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ kind: 'repaint', stage: 'failed' });

    void useEditorJobStore.getState().startRetake('l2', 's1', 'v1');
    await vi.advanceTimersByTimeAsync(0);
    expect(retakeVersion).toHaveBeenCalledWith('v1');
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ kind: 'retake', jobId: 'j2', stage: 'running' });
  });

  it('still refuses a second start while one is in flight', async () => {
    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 1 });
    await vi.advanceTimersByTimeAsync(0);

    await useEditorJobStore.getState().startRetake('l2', 's1', 'v1');
    expect(retakeVersion).not.toHaveBeenCalled();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ kind: 'repaint', stage: 'running' });
  });
});
