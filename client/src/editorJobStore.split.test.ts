import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const repaint = vi.fn();
const jobStatus = vi.fn();
const startSplit = vi.fn();
const splitStatus = vi.fn();
const cancelSplit = vi.fn();
vi.mock('./api', () => ({
  api: {
    repaint: (...args: unknown[]) => repaint(...args),
    jobStatus: (id: string) => jobStatus(id),
    startSplit: (...args: unknown[]) => startSplit(...args),
    splitStatus: (id: string) => splitStatus(id),
    cancelSplit: (id: string) => cancelSplit(id),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const { useEditorJobStore, selectSplitRunning } = await import('./editorJobStore');

const POLL_MS = 2000;
const store = () => useEditorJobStore.getState();
const settled = { status: 'done', stems: [{ kind: 'vocals', status: 'failed', error: 'boom' }] };
const repaintParams = { prompt: 'p', start: 0, end: 1 };

describe('the split slot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorJobStore.setState({ editorJob: null, splitJob: null });
    repaint.mockReset().mockResolvedValue({ jobId: 'r1' });
    jobStatus.mockReset().mockResolvedValue({ status: 'running' });
    startSplit.mockReset().mockResolvedValueOnce({ jobId: 's1' }).mockResolvedValueOnce({ jobId: 's2' });
    splitStatus.mockReset().mockResolvedValue(settled);
    cancelSplit.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await store().cancelSplit(); // ends the split poll loop
    vi.useRealTimers();
  });

  it('lets a repaint run beside a settled split, keeping its stems', async () => {
    void store().startSplit('l1', 'song', 'acestep');
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store().splitJob).toMatchObject({ stage: 'done', splitJobId: 's1' });
    expect(selectSplitRunning(store())).toBe(false);

    void store().startRepaint('l2', 'song', repaintParams);
    await vi.advanceTimersByTimeAsync(0);
    expect(repaint).toHaveBeenCalled();
    expect(store().editorJob).toMatchObject({ kind: 'repaint', jobId: 'r1', stage: 'running' });
    expect(store().splitJob).toMatchObject({ stage: 'done', splitJobId: 's1' });
  });

  it('refuses a repaint while a split is still extracting', async () => {
    splitStatus.mockReset().mockResolvedValue({ status: 'running', stems: [] });
    void store().startSplit('l1', 'song', 'acestep');
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(selectSplitRunning(store())).toBe(true);

    await store().startRepaint('l2', 'song', repaintParams);
    expect(repaint).not.toHaveBeenCalled();
    expect(store().editorJob).toBeNull();
  });

  it('replaces a settled split with a new one, closing the old one on the server', async () => {
    void store().startSplit('l1', 'song', 'acestep');
    await vi.advanceTimersByTimeAsync(POLL_MS);

    void store().startSplit('l2', 'song', 'acestep');
    await vi.advanceTimersByTimeAsync(0);
    expect(cancelSplit).toHaveBeenCalledWith('s1');
    expect(store().splitJob).toMatchObject({ layerId: 'l2', splitJobId: 's2', stage: 'running' });
  });

  it('keeps a failed split start with its error, blocking nothing', async () => {
    startSplit.mockReset().mockRejectedValue(new Error('ACE-Step down'));
    await store().startSplit('l1', 'song', 'acestep');
    expect(store().splitJob).toMatchObject({ stage: 'failed', error: 'ACE-Step down' });
    expect(selectSplitRunning(store())).toBe(false);

    void store().startRepaint('l2', 'song', repaintParams);
    await vi.advanceTimersByTimeAsync(0);
    expect(store().editorJob).toMatchObject({ kind: 'repaint', stage: 'running' });
  });
});
