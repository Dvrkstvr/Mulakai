/** Every client job store follows a job through the server's queue (PLAN.md "UI Redesign", S4):
 * `queued` is waiting, not an error, and a job cancelled from UP NEXT leaves without a FAILED row. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const jobStatus = vi.fn();
const submitted = { jobId: 'j1' };
vi.mock('./api', () => ({
  api: {
    generate: async () => submitted,
    repaint: async () => submitted,
    transcribe: async () => submitted,
    readLyrics: async () => submitted,
    readTimings: async () => submitted,
    analyzeSourceAudio: async () => submitted,
    jobStatus: (...a: unknown[]) => jobStatus(...a),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const { useGenerationStore } = await import('./generationStore');
const { useEditorJobStore } = await import('./editorJobStore');
const { useTranscribeStore } = await import('./transcribeStore');
const { useReadLyricsStore } = await import('./readLyricsStore');
const { useTimingsStore } = await import('./timingsStore');
const { analyzeAndWait, AnalyzeCancelled, ANALYZE_POLL_MS } = await import('./analyzeJob');
const { localSettled, timingsFailed } = await import('./activitySettle');

const queued = (queuePosition: number) => ({ status: 'queued', queuePosition });
const CANCELLED = { status: 'failed', error: 'cancelled', cancelled: true };
const tick = (ms = 2000) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  jobStatus.mockReset();
  useGenerationStore.setState({ job: null, otherLock: null });
  useEditorJobStore.setState({ editorJob: null, splitJob: null });
  useTranscribeStore.getState().reset();
  useReadLyricsStore.getState().reset();
  useTimingsStore.setState({ runs: {} });
});
afterEach(() => vi.useRealTimers());

describe('a queued generation', () => {
  it('waits as loading with its place in line, then runs and lands', async () => {
    jobStatus.mockResolvedValueOnce(queued(2)).mockResolvedValueOnce(queued(1))
      .mockResolvedValueOnce({ status: 'running', progress: 0.3 }).mockResolvedValueOnce({ status: 'done', songId: 's1' });
    await useGenerationStore.getState().start({ title: 'T', prompt: 'p' }, { genType: 'prompt' });
    await tick();
    expect(useGenerationStore.getState().job).toMatchObject({ stage: 'loading', queuePosition: 2 });
    await tick();
    expect(useGenerationStore.getState().job?.queuePosition).toBe(1);
    await tick();
    expect(useGenerationStore.getState().job).toMatchObject({ stage: 'running', queuePosition: undefined, progress: 0.3 });
    await tick();
    expect(useGenerationStore.getState().job).toMatchObject({ stage: 'done', songId: 's1' });
  });

  it('is dropped, not failed, once cancelled from UP NEXT', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce(CANCELLED);
    await useGenerationStore.getState().start({ title: 'T', prompt: 'p' }, { genType: 'prompt' });
    await tick();
    await tick();
    expect(useGenerationStore.getState().job).toBeNull();
  });
});

describe('a queued editor job', () => {
  it('keeps its running stage with a queue position until it starts', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce({ status: 'running', progress: 0.5 });
    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 4 });
    await tick(0);
    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'running', queuePosition: 1 });
    await tick();
    expect(useEditorJobStore.getState().editorJob).toMatchObject({ stage: 'running', queuePosition: undefined, progress: 0.5 });
  });

  it('is dropped once cancelled, leaving the slot free', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce(CANCELLED);
    void useEditorJobStore.getState().startRepaint('l1', 's1', { prompt: 'p', start: 0, end: 4 });
    await tick(0);
    await tick();
    await tick();
    expect(useEditorJobStore.getState().editorJob).toBeNull();
  });
});

describe('TRANSCRIBE and READ LYRICS while queued', () => {
  it('keep running through `queued`, and a cancel goes idle without a DONE row', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce(CANCELLED);
    const run = useTranscribeStore.getState().start('yue2', new Blob(['a']), 'x', '');
    await tick(0);
    expect(useTranscribeStore.getState()).toMatchObject({ stage: 'running', jobId: 'j1' });
    await tick(1500);
    expect(useTranscribeStore.getState().stage).toBe('running');
    await tick(1500);
    expect(await run).toBe(false);
    const after = useTranscribeStore.getState();
    expect(after).toMatchObject({ stage: 'idle', cancelled: true, error: undefined });
    expect(localSettled('transcribe', { stage: 'running' }, after, () => true)).toBeNull();
  });

  it('READ LYRICS goes idle on a cancel, with no error', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce(CANCELLED);
    const run = useReadLyricsStore.getState().start(new Blob(['a']), 'x', '', 'any');
    await tick(1500);
    expect(useReadLyricsStore.getState()).toMatchObject({ stage: 'running', jobId: 'j1' });
    await tick(1500);
    await run;
    expect(useReadLyricsStore.getState()).toMatchObject({ stage: 'idle', cancelled: true, error: undefined });
  });
});

describe('word timings while queued', () => {
  it('stick as cancelled (so the auto-read waits for RETRY) without a FAILED row', async () => {
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce(CANCELLED);
    const read = useTimingsStore.getState().read('v1');
    await tick();
    expect(useTimingsStore.getState().runs.v1).toEqual({ stage: 'running', jobId: 'j1' });
    await tick();
    await read;
    const runs = useTimingsStore.getState().runs;
    expect(runs.v1).toMatchObject({ stage: 'failed', cancelled: true });
    expect(timingsFailed({ v1: { stage: 'running' } }, runs, () => true)).toEqual([]);
  });
});

describe('analyzeAndWait', () => {
  it('polls a queued analysis until its result arrives', async () => {
    const analysis = { caption: 'a piano ballad', lyrics: '' };
    jobStatus.mockResolvedValueOnce(queued(1)).mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'done', analysis });
    const result = analyzeAndWait({ file: new Blob(['a']) }, 'turbo');
    await tick(ANALYZE_POLL_MS * 3);
    expect(await result).toEqual(analysis);
  });

  it('throws AnalyzeCancelled for a cancel, the error for a failure, and stops once unwanted', async () => {
    jobStatus.mockResolvedValueOnce(CANCELLED);
    const cancelled = analyzeAndWait({ file: new Blob(['a']) }, 'turbo');
    const caught = cancelled.catch((e: unknown) => e);
    await tick(ANALYZE_POLL_MS);
    expect(await caught).toBeInstanceOf(AnalyzeCancelled);

    jobStatus.mockResolvedValueOnce({ status: 'failed', error: 'DiT not initialized' });
    const failed = analyzeAndWait({ file: new Blob(['a']) }, 'turbo').catch((e: Error) => e.message);
    await tick(ANALYZE_POLL_MS);
    expect(await failed).toBe('DiT not initialized');

    jobStatus.mockClear();
    const dropped = analyzeAndWait({ file: new Blob(['a']) }, 'turbo', () => false);
    await tick(ANALYZE_POLL_MS);
    expect(await dropped).toBeNull();
    expect(jobStatus).not.toHaveBeenCalled();
  });
});
