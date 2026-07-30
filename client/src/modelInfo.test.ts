import { describe, it, expect } from 'vitest';
import { modelFamily, autoSteps, stepsMax, guidanceEffective } from './modelInfo';

describe('modelFamily', () => {
  it('classifies the real checkpoint names', () => {
    expect(modelFamily('acestep-v15-xl-turbo')).toBe('turbo');
    expect(modelFamily('acestep-v15-turbo-shift1')).toBe('turbo');
    expect(modelFamily('acestep-v15-xl-sft')).toBe('sft');
    expect(modelFamily('acestep-v15-xl-base')).toBe('other');
  });

  it('matches delimited tokens, not substrings', () => {
    expect(modelFamily('turbocharged-rock')).toBe('other');
  });

  it('reads AUTO as unknown', () => {
    expect(modelFamily('')).toBe('unknown');
  });
});

describe('autoSteps', () => {
  it('reports what STEPS AUTO will resolve to, mirroring the server', () => {
    expect(autoSteps('acestep-v15-xl-turbo')).toBe(8);
    expect(autoSteps('acestep-v15-xl-sft')).toBe(50);
    expect(autoSteps('acestep-v15-base')).toBe(32);
  });

  it('is null under AUTO model, where only the server can know', () => {
    expect(autoSteps('')).toBeNull();
  });
});

describe('stepsMax', () => {
  it('caps turbo low and base/sft high', () => {
    expect(stepsMax('acestep-v15-xl-turbo')).toBe(20);
    expect(stepsMax('acestep-v15-xl-sft')).toBe(200);
    expect(stepsMax('acestep-v15-base')).toBe(200);
  });

  it('keeps a neutral ceiling for AUTO', () => {
    expect(stepsMax('')).toBe(64);
  });

  it('does not cap a custom model merely containing "turbo"', () => {
    expect(stepsMax('turbocharged-rock')).toBe(200);
  });
});

describe('guidanceEffective', () => {
  it('is false only for turbo', () => {
    expect(guidanceEffective('acestep-v15-xl-turbo')).toBe(false);
    expect(guidanceEffective('acestep-v15-xl-sft')).toBe(true);
    expect(guidanceEffective('')).toBe(true);
    expect(guidanceEffective('turbocharged-rock')).toBe(true);
  });
});
