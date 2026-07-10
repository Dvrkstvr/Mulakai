import { describe, it, expect } from 'vitest';
import { fmtProgress, stageDetail } from './genProgress';

describe('fmtProgress', () => {
  it('returns null for undefined or non-finite input', () => {
    expect(fmtProgress(undefined)).toBeNull();
    expect(fmtProgress(NaN)).toBeNull();
  });

  it('formats a 0-1 fraction as a rounded percentage', () => {
    expect(fmtProgress(0)).toBe('0%');
    expect(fmtProgress(0.421)).toBe('42%');
    expect(fmtProgress(1)).toBe('100%');
  });

  it('clamps out-of-range values into 0-100%', () => {
    expect(fmtProgress(-0.5)).toBe('0%');
    expect(fmtProgress(1.5)).toBe('100%');
  });
});

describe('stageDetail', () => {
  it('returns null for undefined, empty, whitespace-only, or the generic "running" default', () => {
    expect(stageDetail(undefined)).toBeNull();
    expect(stageDetail('')).toBeNull();
    expect(stageDetail('   ')).toBeNull();
    expect(stageDetail('running')).toBeNull();
    expect(stageDetail('Running')).toBeNull();
  });

  it('returns a trimmed, informative stage label as-is', () => {
    expect(stageDetail('sampling diffusion step 12/50')).toBe('sampling diffusion step 12/50');
    expect(stageDetail('  vocoding  ')).toBe('vocoding');
  });
});
