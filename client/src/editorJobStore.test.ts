import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const repaint = vi.fn();
const jobStatus = vi.fn();
vi.mock('./api', () => ({
  api: { repaint: (...args: unknown[]) => repaint(...args), jobStatus: (id: string) => jobStatus(id) },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

const { useEditorJobStore } = await import('./editorJobStore');

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
