import { beforeEach, describe, expect, it } from 'vitest';
import { addSample, etaKey, formatEta, meanMs, useEtaStore } from './etaStore';
import { useGenerationStore, type GenerationJob } from './generationStore';

const KEY = etaKey({ task: 'text2music', engine: 'acestep', family: 'turbo', quality: 'balanced' });
const job = (over: Partial<GenerationJob>): GenerationJob =>
  ({ key: 'g1', jobId: 'j1', title: 't', caption: '', stage: 'running', startedAt: 1_000, draft: {}, ...over });

describe('ETA averaging', () => {
  it('keeps only the last five samples', () => {
    let list: number[] | undefined;
    for (const ms of [10, 20, 30, 40, 50, 60]) list = addSample(list, ms);
    expect(list).toEqual([20, 30, 40, 50, 60]);
  });

  it('has no mean without a sample, so the row stays hidden', () => {
    expect(meanMs(undefined)).toBeNull();
    expect(meanMs([])).toBeNull();
    expect(meanMs([30_000, 60_000])).toBe(45_000);
  });

  it('reads seconds under a minute and a half, minutes past it', () => {
    expect(formatEta(44_000)).toBe('45 s');
    expect(formatEta(1_000)).toBe('5 s');
    expect(formatEta(150_000)).toBe('3 min');
  });

  it('keys by task, engine, model family and quality', () => {
    expect(KEY).toBe('text2music|acestep|turbo|balanced');
    expect(etaKey({ task: 'cover', engine: 'yue2', family: 'na', quality: 'na' })).toBe('cover|yue2|na|na');
  });
});

describe('recording settled generations', () => {
  beforeEach(() => {
    useEtaStore.setState({ samples: {}, pending: null });
    useGenerationStore.setState({ jobs: [] });
  });

  it('records submit-to-done wall clock for the job Create submitted', () => {
    useGenerationStore.setState({ jobs: [job({})] });
    useEtaStore.getState().expect(KEY, 1_000);
    useGenerationStore.setState({ jobs: [job({ stage: 'done' })] });
    const [sample] = useEtaStore.getState().samples[KEY];
    expect(sample).toBeGreaterThan(0);
    expect(useEtaStore.getState().pending).toBeNull();
  });

  it('drops a failed job without a sample', () => {
    useGenerationStore.setState({ jobs: [job({})] });
    useEtaStore.getState().expect(KEY, 1_000);
    useGenerationStore.setState({ jobs: [job({ stage: 'failed', error: 'x' })] });
    expect(useEtaStore.getState().samples[KEY]).toBeUndefined();
    expect(useEtaStore.getState().pending).toBeNull();
  });

  it('ignores a job it was not told to expect (adopted after a reload)', () => {
    useEtaStore.getState().expect(KEY, 5_000);
    useGenerationStore.setState({ jobs: [job({ stage: 'done' })] });
    expect(useEtaStore.getState().samples[KEY]).toBeUndefined();
    expect(useEtaStore.getState().pending).not.toBeNull();
  });
});
