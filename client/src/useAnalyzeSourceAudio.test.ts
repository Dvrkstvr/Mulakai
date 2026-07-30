import { describe, it, expect } from 'vitest';
import { canAnalyze, fillable, type AnalyzeSource } from './useAnalyzeSourceAudio';

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

describe('fillable', () => {
  it('fills an empty field', () => {
    expect(fillable('', false)).toBe(true);
  });

  it('leaves text the user wrote in this tab alone', () => {
    expect(fillable('a driving synthwave track', false)).toBe(false);
    expect(fillable('a driving synthwave track')).toBe(false);
  });

  // Without this, reusing/typing a prompt in PROMPT then switching to COVER left ANALYZE AUDIO
  // unable to describe the source, because a field written for a different task looked "taken".
  it('overwrites text carried in from another tab', () => {
    expect(fillable('a driving synthwave track', true)).toBe(true);
  });
});
