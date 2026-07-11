import { describe, it, expect } from 'vitest';
import { canAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';

const fileSource = (): AnalyzeSource => ({ kind: 'file', resolve: async () => new Blob() });
const scratchSource = (jobId: string, stemKind: 'vocals' | 'drums' | 'bass' | 'other'): AnalyzeSource => ({
  kind: 'scratch', jobId, stemKind,
});

describe('canAnalyze', () => {
  it('is true with a source, a model, and nothing busy', () => {
    expect(canAnalyze(fileSource(), 'acestep-xl-sft', false)).toBe(true);
    expect(canAnalyze(scratchSource('job1', 'vocals'), 'acestep-xl-sft', false)).toBe(true);
  });

  it('is false with no source', () => {
    expect(canAnalyze(null, 'acestep-xl-sft', false)).toBe(false);
  });

  it('is false with no model selected', () => {
    expect(canAnalyze(fileSource(), '', false)).toBe(false);
  });

  it('is false while busy (already analyzing or generating)', () => {
    expect(canAnalyze(fileSource(), 'acestep-xl-sft', true)).toBe(false);
  });
});
