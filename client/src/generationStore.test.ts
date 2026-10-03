import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const generate = vi.fn();
const generateWithEngine = vi.fn();
const coverWithEngine = vi.fn();
const generateFromAudio = vi.fn();
const activeGeneration = vi.fn();
const queue = vi.fn(async () => ({ running: null, queued: [] }));
const jobStatus = vi.fn((..._a: unknown[]) => new Promise(() => {})); // never settles: polling is not under test
vi.mock('./api', () => ({
  api: {
    generate: (...a: unknown[]) => generate(...a),
    generateWithEngine: (...a: unknown[]) => generateWithEngine(...a),
    coverWithEngine: (...a: unknown[]) => coverWithEngine(...a),
    generateFromAudio: (...a: unknown[]) => generateFromAudio(...a),
    activeGeneration: () => activeGeneration(),
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

const { useGenerationStore } = await import('./generationStore');
const { isGenerating } = await import('./generationJob');
const { ApiError } = await import('./api');
const { JOB_GONE } = await import('./jobGone');
const params = { title: 'T', prompt: 'indie pop' };
const jobs = () => useGenerationStore.getState().jobs;

beforeEach(() => {
  useGenerationStore.setState({ jobs: [], otherLock: null });
  generate.mockReset().mockResolvedValue({ jobId: 'ace-job' });
  generateWithEngine.mockReset().mockResolvedValue({ jobId: 'engine-job' });
  coverWithEngine.mockReset().mockResolvedValue({ jobId: 'cover-job' });
  generateFromAudio.mockReset().mockResolvedValue({ jobId: 'audio-job' });
});

describe('polling', () => {
  afterEach(() => {
    vi.useRealTimers();
    jobStatus.mockReset().mockImplementation(() => new Promise(() => {})); // back to never settling
  });

  it('fails the card once the server no longer has the job, instead of polling a 404 forever', async () => {
    vi.useFakeTimers();
    jobStatus.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError('unknown job', 404));
    await useGenerationStore.getState().start(params, { genType: 'prompt' });

    await vi.advanceTimersByTimeAsync(2000);
    expect(jobs()[0]).toMatchObject({ jobId: 'ace-job', stage: 'loading' }); // retried
    await vi.advanceTimersByTimeAsync(2000);
    expect(jobs()[0]).toMatchObject({ stage: 'failed', error: JOB_GONE });
  });

  it('stops polling a running job once it is dismissed', async () => {
    vi.useFakeTimers();
    jobStatus.mockResolvedValue({ status: 'running', progress: 0.2 });
    const key = await useGenerationStore.getState().start(params, { genType: 'prompt' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(jobStatus).toHaveBeenCalledTimes(1);

    useGenerationStore.getState().dismiss(key);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(jobStatus).toHaveBeenCalledTimes(1);
    expect(jobs()).toEqual([]);
  });

  it('polls a job adopted twice at mount (StrictMode) only once per tick, with one card', async () => {
    vi.useFakeTimers();
    jobStatus.mockResolvedValue({ status: 'running' });
    activeGeneration.mockResolvedValue({ active: { kind: 'generate', jobId: 'adopted-1', status: 'running', title: 'T', startedAt: 0 } });
    await Promise.all([useGenerationStore.getState().hydrate(), useGenerationStore.getState().hydrate()]);
    expect(jobs()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(jobStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(jobStatus).toHaveBeenCalledTimes(2);
    useGenerationStore.getState().dismiss(jobs()[0].key); // let the loop end before the next test
    await vi.advanceTimersByTimeAsync(2000);
  });

  it('follows two generations side by side, each to its own end', async () => {
    vi.useFakeTimers();
    generate.mockResolvedValueOnce({ jobId: 'first' }).mockResolvedValueOnce({ jobId: 'second' });
    jobStatus.mockImplementation(async (id) => (id === 'first'
      ? { status: 'running', progress: 0.5 } : { status: 'queued', queuePosition: 1 }));
    await useGenerationStore.getState().start(params, { genType: 'prompt' });
    await useGenerationStore.getState().start({ ...params, title: 'U' }, { genType: 'prompt' });

    await vi.advanceTimersByTimeAsync(2000);
    expect(jobs()).toMatchObject([
      { jobId: 'first', stage: 'running', progress: 0.5 },
      { jobId: 'second', title: 'U', stage: 'loading', queuePosition: 1 },
    ]);
    jobStatus.mockImplementation(async (id) => (id === 'first' ? { status: 'done', songId: 's1' } : { status: 'running' }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(jobs()).toMatchObject([{ jobId: 'first', stage: 'done', songId: 's1' }, { jobId: 'second', stage: 'running' }]);
    await vi.advanceTimersByTimeAsync(1000); // the done card lingers, then goes
    expect(jobs().map((j) => j.jobId)).toEqual(['second']);
    useGenerationStore.getState().dismiss(jobs()[0].key);
    await vi.advanceTimersByTimeAsync(2000);
  });
});

describe('start routing', () => {
  it('sends an ACE-Step draft to /api/generate, with its reference audio', async () => {
    const ref = new Blob(['x']);
    await useGenerationStore.getState().start(params, { genType: 'prompt' }, ref);
    expect(generate).toHaveBeenCalledWith(params, ref);
    expect(generateWithEngine).not.toHaveBeenCalled();
    expect(jobs()[0].jobId).toBe('ace-job');
  });

  it('sends a draft on an extra engine to that engine, and keeps the engine for RETRY', async () => {
    await useGenerationStore.getState().start(params, { genType: 'prompt', engine: 'yue2' });
    expect(generateWithEngine).toHaveBeenCalledWith('yue2', params);
    expect(generate).not.toHaveBeenCalled();
    expect(jobs()[0]).toMatchObject({ jobId: 'engine-job', draft: { engine: 'yue2' } });
  });

  it('treats an explicit acestep engine like no engine', async () => {
    await useGenerationStore.getState().start(params, { genType: 'prompt', engine: 'acestep' });
    expect(generate).toHaveBeenCalled();
  });

  it("fails the card with the submit's error — a full queue, say — and resolves with its key", async () => {
    generate.mockRejectedValue(new Error('the queue is full (10 jobs waiting) — cancel one or wait for one to finish'));
    const key = await useGenerationStore.getState().start(params, { genType: 'prompt' });
    expect(jobs()).toMatchObject([{ key, stage: 'failed', error: expect.stringContaining('the queue is full') }]);
  });

  it("sends a cover to the engine's cover route, and keeps the draft for RETRY", async () => {
    const cover = { title: 'T', prompt: 'folk', abc: 'X:1\n', source: 'Ellies City 2' };
    await useGenerationStore.getState().startCover('yue2', cover, { genType: 'audio', coverEngine: 'yue2' });
    expect(coverWithEngine).toHaveBeenCalledWith('yue2', cover);
    expect(jobs()[0]).toMatchObject({ jobId: 'cover-job', draft: { coverEngine: 'yue2' } });
  });

  it('asks for a fresh queue snapshot once a submit is accepted', async () => {
    queue.mockClear();
    await useGenerationStore.getState().start(params, { genType: 'prompt' });
    expect(queue).toHaveBeenCalled();
  });
});

describe('several at once', () => {
  it('starts a second generation while the first is in flight: the server queues it', async () => {
    generateFromAudio.mockResolvedValueOnce({ jobId: 'a1' }).mockResolvedValueOnce({ jobId: 'a2' });
    const first = await useGenerationStore.getState().startFromAudio(params, new Blob(['src']), { genType: 'audio' });
    const second = await useGenerationStore.getState().startFromAudio(params, new Blob(['src']), { genType: 'audio' });
    expect(generateFromAudio).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(jobs().map((j) => [j.key, j.jobId])).toEqual([[first, 'a1'], [second, 'a2']]);
  });

  it('dismisses one card, leaving the others', async () => {
    generate.mockResolvedValueOnce({ jobId: 'x' }).mockResolvedValueOnce({ jobId: 'y' });
    const first = await useGenerationStore.getState().start(params, { genType: 'prompt' });
    await useGenerationStore.getState().start(params, { genType: 'prompt' });
    useGenerationStore.getState().dismiss(first);
    expect(jobs().map((j) => j.jobId)).toEqual(['y']);
  });

  it.each([
    ['loading', true], ['running', true], ['done', true], ['failed', false],
  ] as const)('isGenerating(%s) is %s', (stage, expected) => {
    expect(isGenerating({ key: 'k', jobId: 'j', title: 'T', caption: '', stage, startedAt: 1, draft: {} })).toBe(expected);
  });
});
