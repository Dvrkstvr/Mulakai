/** generationStore adopting what the server runs: after a reload, or a generation started in
 * another tab (each gets its own card), and the running job of another kind (otherLock). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const generate = vi.fn();
const activeGeneration = vi.fn();
vi.mock('./api', () => ({
  api: {
    generate: (...a: unknown[]) => generate(...a),
    activeGeneration: () => activeGeneration(),
    jobStatus: () => new Promise(() => {}), // never settles: polling is not under test
    queue: async () => ({ running: null, queued: [] }),
  },
  ApiError: class ApiError extends Error {},
}));

const { useGenerationStore } = await import('./generationStore');
const params = { title: 'T', prompt: 'indie pop' };
const jobs = () => useGenerationStore.getState().jobs;

beforeEach(() => {
  useGenerationStore.setState({ jobs: [], otherLock: null });
  generate.mockReset().mockResolvedValue({ jobId: 'ace-job' });
});

describe('rehydrating from the running job', () => {
  it('reopens RETRY on the engine the running job uses', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', title: 'T', caption: 'c', task: 'text2music', engine: 'yue2',
      startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(jobs()[0].draft).toEqual({ genType: 'prompt', prompt: 'c', engine: 'yue2' });
  });

  it('reopens a YuE2 cover on COVER with its engine', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', caption: 'folk', task: 'cover', engine: 'yue2', startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(jobs()[0].draft).toEqual({ genType: 'audio', prompt: 'folk', coverEngine: 'yue2' });
  });

  it('leaves the engine out for an ACE-Step job', async () => {
    activeGeneration.mockResolvedValue({ active: {
      kind: 'generate', jobId: 'j', task: 'cover', startedAt: 1, status: 'running',
    } });
    await useGenerationStore.getState().hydrate();
    expect(jobs()[0].draft).toEqual({ genType: 'audio', prompt: undefined });
  });
});

describe('refreshLock', () => {
  it("adopts another tab's generation beside this tab's own, but not one it already follows", async () => {
    await useGenerationStore.getState().start(params, { genType: 'prompt' });
    activeGeneration.mockResolvedValue({ active: { kind: 'generate', jobId: 'ace-job', status: 'running', startedAt: 1 } });
    await useGenerationStore.getState().refreshLock();
    expect(jobs()).toHaveLength(1);
    activeGeneration.mockResolvedValue({ active: { kind: 'generate', jobId: 'elsewhere', title: 'Other', status: 'running', startedAt: 1 } });
    await useGenerationStore.getState().refreshLock();
    expect(jobs().map((j) => j.jobId)).toEqual(['ace-job', 'elsewhere']);
  });

  it('tracks a running job of another kind, and clears it once the GPU is free', async () => {
    activeGeneration.mockResolvedValue({ active: { kind: 'analyze', jobId: 'a1', startedAt: 1, status: 'running' } });
    await useGenerationStore.getState().refreshLock();
    expect(useGenerationStore.getState().otherLock).toEqual({ kind: 'analyze', songId: undefined });
    activeGeneration.mockResolvedValue({ active: null });
    await useGenerationStore.getState().refreshLock();
    expect(useGenerationStore.getState().otherLock).toBeNull();
  });
});
