import { describe, it, expect } from 'vitest';
import { sourceKey, shouldAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';

const fileSource = (key: string): AnalyzeSource => ({ kind: 'file', key, resolve: async () => new Blob() });
const scratchSource = (jobId: string, stemKind: 'vocals' | 'drums' | 'bass' | 'other'): AnalyzeSource => ({
  kind: 'scratch', jobId, stemKind,
});

describe('sourceKey', () => {
  it('is null for no source', () => {
    expect(sourceKey(null)).toBeNull();
  });

  it('differs for distinct file sources and is stable for the same key', () => {
    expect(sourceKey(fileSource('a.wav'))).toBe(sourceKey(fileSource('a.wav')));
    expect(sourceKey(fileSource('a.wav'))).not.toBe(sourceKey(fileSource('b.wav')));
  });

  it('differs for distinct scratch sources and is stable for the same job/stem', () => {
    expect(sourceKey(scratchSource('job1', 'vocals'))).toBe(sourceKey(scratchSource('job1', 'vocals')));
    expect(sourceKey(scratchSource('job1', 'vocals'))).not.toBe(sourceKey(scratchSource('job1', 'drums')));
    expect(sourceKey(scratchSource('job1', 'vocals'))).not.toBe(sourceKey(scratchSource('job2', 'vocals')));
  });

  it('does not collide a file source with a scratch source that happens to share a raw id', () => {
    expect(sourceKey(fileSource('job1'))).not.toBe(sourceKey(scratchSource('job1', 'vocals')));
  });
});

describe('shouldAnalyze', () => {
  it('fires once per distinct source when the prompt is empty', () => {
    const source = fileSource('a.wav');
    expect(shouldAnalyze(source, '', null)).toBe(true);
    // once "fired" (firedKey === this source's key), it should not fire again
    expect(shouldAnalyze(source, '', sourceKey(source))).toBe(false);
  });

  it('fires again for a newly distinct source even if a prior source already fired', () => {
    const first = fileSource('a.wav');
    const second = fileSource('b.wav');
    expect(shouldAnalyze(second, '', sourceKey(first))).toBe(true);
  });

  it('does not fire when there is no source', () => {
    expect(shouldAnalyze(null, '', null)).toBe(false);
  });

  it('does not fire when the prompt is already non-empty', () => {
    const source = fileSource('a.wav');
    expect(shouldAnalyze(source, 'already typed something', null)).toBe(false);
  });

  it('treats a whitespace-only prompt as empty (still fires)', () => {
    const source = fileSource('a.wav');
    expect(shouldAnalyze(source, '   ', null)).toBe(true);
  });

  it('does not re-fire on unrelated re-renders (same source, same fired key, prompt still empty)', () => {
    const source = fileSource('a.wav');
    const firedKey = sourceKey(source);
    // Simulates repeated effect re-runs from unrelated state changes elsewhere in the component.
    expect(shouldAnalyze(source, '', firedKey)).toBe(false);
    expect(shouldAnalyze(source, '', firedKey)).toBe(false);
  });
});
