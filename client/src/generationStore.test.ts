import { describe, it, expect, beforeEach, vi } from 'vitest';

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
}));

const { useGenerationStore } = await import('./generationStore');
const { isGenerating } = await import('./generationJob');
const params = { title: 'T', prompt: 'indie pop' };

beforeEach(() => {
  useGenerationStore.setState({ job: null, otherLock: null });
  generate.mockReset().mockResolvedValue({ jobId: 'ace-job' });
  generateWithEngine.mockReset().mockResolvedValue({ jobId: 'engine-job' });
  coverWithEngine.mockReset().mockResolvedValue({ jobId: 'cover-job' });
  generateFromAudio.mockReset().mockResolvedValue({ jobId: 'audio-job' });
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
