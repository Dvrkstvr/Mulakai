import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const generate = vi.fn();
const generateWithEngine = vi.fn();
const coverWithEngine = vi.fn();
const generateFromAudio = vi.fn();
const activeGeneration = vi.fn();
const jobStatus = vi.fn(() => new Promise(() => {})); // never settles: polling is not under test
vi.mock('./api', () => ({
  api: {
    generate: (...a: unknown[]) => generate(...a),
    generateWithEngine: (...a: unknown[]) => generateWithEngine(...a),
    coverWithEngine: (...a: unknown[]) => coverWithEngine(...a),
    generateFromAudio: (...a: unknown[]) => generateFromAudio(...a),
    activeGeneration: () => activeGeneration(),
    jobStatus: () => jobStatus(),
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
const { busyMessage, coverLocked, isGenerating } = await import('./generationJob');
const { ApiError } = await import('./api');
const { JOB_GONE } = await import('./jobGone');
const params = { title: 'T', prompt: 'indie pop' };

beforeEach(() => {
  useGenerationStore.setState({ job: null, otherLock: null });
  generate.mockReset().mockResolvedValue({ jobId: 'ace-job' });
  generateWithEngine.mockReset().mockResolvedValue({ jobId: 'engine-job' });
  coverWithEngine.mockReset().mockResolvedValue({ jobId: 'cover-job' });
  generateFromAudio.mockReset().mockResolvedValue({ jobId: 'audio-job' });
});

describe('polling', () => {
  afterEach(() => vi.useRealTimers());

  it('fails the card once the server no longer has the job, instead of polling a 404 forever', async () => {
    vi.useFakeTimers();
    jobStatus.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError('unknown job', 404));
    await useGenerationStore.getState().start(params, { genType: 'prompt' });

    await vi.advanceTimersByTimeAsync(2000);
    expect(useGenerationStore.getState().job).toMatchObject({ jobId: 'ace-job', stage: 'loading' }); // retried
    await vi.advanceTimersByTimeAsync(2000);
    expect(useGenerationStore.getState().job).toMatchObject({ stage: 'failed', error: JOB_GONE });
  });
});

describe('start routing', () => {
  it('sends an ACE-Step draft to /api/generate, with its reference audio', async () => {
    const ref = new Blob(['x']);
    await useGenerationStore.getState().start(params, { genType: 'prompt' }, ref);
    expect(generate).toHaveBeenCalledWith(params, ref);
    expect(generateWithEngine).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().job?.jobId).toBe('ace-job');
  });

  it('sends a draft on an extra engine to that engine, and keeps the engine for RETRY', async () => {
    await useGenerationStore.getState().start(params, { genType: 'prompt', engine: 'yue2' });
    expect(generateWithEngine).toHaveBeenCalledWith('yue2', params);
    expect(generate).not.toHaveBeenCalled();
    expect(useGenerationStore.getState().job).toMatchObject({ jobId: 'engine-job', draft: { engine: 'yue2' } });
  });

  it('treats an explicit acestep engine like no engine', async () => {
    await useGenerationStore.getState().start(params, { genType: 'prompt', engine: 'acestep' });
    expect(generate).toHaveBeenCalled();
  });

  it('fails the card with the submit\'s error', async () => {
    generateWithEngine.mockRejectedValue(new Error('YUE2 is not configured'));
    await useGenerationStore.getState().start(params, { genType: 'prompt', engine: 'yue2' });
    expect(useGenerationStore.getState().job).toMatchObject({ stage: 'failed', error: 'YUE2 is not configured' });
  });
});

describe('rehydrating from the lock', () => {
  it('reopens RETRY on the engine the running job uses', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', title: 'T', caption: 'c', task: 'text2music', engine: 'yue2',
      startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(useGenerationStore.getState().job?.draft).toEqual({ genType: 'prompt', prompt: 'c', engine: 'yue2' });
  });

  it('reopens a YuE2 cover on COVER with its engine', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', caption: 'folk', task: 'cover', engine: 'yue2', startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(useGenerationStore.getState().job?.draft).toEqual({ genType: 'audio', prompt: 'folk', coverEngine: 'yue2' });
  });

  it('leaves the engine out for an ACE-Step job', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', task: 'cover', startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(useGenerationStore.getState().job?.draft).toEqual({ genType: 'audio', prompt: undefined });
  });
});

describe('startCover', () => {
  it("sends a cover to the engine's cover route, and keeps the draft for RETRY", async () => {
    const cover = { title: 'T', prompt: 'folk', abc: 'X:1\n', source: 'Ellies City 2' };
    await useGenerationStore.getState().startCover('yue2', cover, { genType: 'audio', coverEngine: 'yue2' });
    expect(coverWithEngine).toHaveBeenCalledWith('yue2', cover);
    expect(useGenerationStore.getState().job).toMatchObject({ jobId: 'cover-job', draft: { coverEngine: 'yue2' } });
  });
});

describe('a failed job blocks nothing', () => {
  const failed = { jobId: 'old', title: 'T', caption: '', stage: 'failed' as const, error: 'boom', startedAt: 1, draft: { genType: 'audio' as const } };

  it.each([
    ['loading', true], ['running', true], ['done', true], ['failed', false],
  ] as const)('isGenerating(%s) is %s', (stage, expected) => {
    expect(isGenerating({ ...failed, stage })).toBe(expected);
  });

  it("doesn't let a failed cover hold COVER · YUE2's panel", () => {
    expect(coverLocked(failed, null, false)).toBe(false);
    expect(coverLocked({ ...failed, stage: 'running' }, null, false)).toBe(true);
    expect(coverLocked(null, { kind: 'repaint' }, false)).toBe(true); // a lock held elsewhere
    expect(coverLocked(null, { kind: 'lyrics' }, true)).toBe(false); // the panel's own read
  });

  it('starts a new cover over a failed one, replacing its card', async () => {
    useGenerationStore.setState({ job: failed });
    await useGenerationStore.getState().startFromAudio(params, new Blob(['src']), { genType: 'audio' });
    expect(generateFromAudio).toHaveBeenCalledTimes(1);
    expect(useGenerationStore.getState().job).toMatchObject({ jobId: 'audio-job', stage: 'loading' });
  });

  it('still refuses a second start while a job is in flight', async () => {
    useGenerationStore.setState({ job: { ...failed, stage: 'running' } });
    await useGenerationStore.getState().startFromAudio(params, new Blob(['src']), { genType: 'audio' });
    expect(generateFromAudio).not.toHaveBeenCalled();
  });

  it('keeps tracking other locks while a failed card is showing', async () => {
    useGenerationStore.setState({ job: failed });
    activeGeneration.mockResolvedValue({ active: { kind: 'repaint', songId: 's1' } });
    await useGenerationStore.getState().refreshLock();
    expect(useGenerationStore.getState()).toMatchObject({ otherLock: { kind: 'repaint', songId: 's1' }, job: failed });
  });
});

describe('busy messages name the lock holder', () => {
  const running = { jobId: 'j', title: 'T', caption: '', stage: 'running' as const, startedAt: 1, draft: { genType: 'prompt' as const } };

  it('names an audio analysis seen in the lock (another tab, or this one)', async () => {
    activeGeneration.mockResolvedValue({ active: { kind: 'analyze', jobId: 'a1', startedAt: 1, status: 'running' } });
    await useGenerationStore.getState().refreshLock();
    const { job, otherLock } = useGenerationStore.getState();
    expect(otherLock).toEqual({ kind: 'analyze', songId: undefined });
    expect(busyMessage(job, otherLock)).toBe('WAIT FOR ANALYZE AUDIO');
  });

  it("keeps a song generation's own wording, and is null when the lock is free", () => {
    expect(busyMessage(running, null)).toBe('WAIT FOR A GENERATION');
    expect(busyMessage({ ...running, stage: 'failed' }, null)).toBeNull();
    expect(busyMessage(null, { kind: 'repaint' })).toBe('WAIT FOR A REPAINT');
    expect(busyMessage(null, null)).toBeNull();
  });

  it('clears once the analysis releases the lock', async () => {
    useGenerationStore.setState({ otherLock: { kind: 'analyze' } });
    activeGeneration.mockResolvedValue({ active: null });
    await useGenerationStore.getState().refreshLock();
    expect(busyMessage(null, useGenerationStore.getState().otherLock)).toBeNull();
  });
});
