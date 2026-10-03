import { describe, it, expect } from 'vitest';
import { migrateQuality, qualityHint, qualitySteps, resolveSteps } from './qualitySteps';

describe('qualitySteps', () => {
  it.each([
    ['turbo', 4, null, 12],
    ['sft', 24, null, 80],
    ['other', 16, null, 64],
  ] as const)('maps %s to DRAFT %s / BALANCED %s / BEST %s', (family, draft, balanced, best) => {
    expect(qualitySteps('draft', family)).toBe(draft);
    expect(qualitySteps('balanced', family)).toBe(balanced);
    expect(qualitySteps('best', family)).toBe(best);
  });

  it('sends AUTO for every preset when the model family is unknown', () => {
    expect(qualitySteps('draft', 'unknown')).toBeNull();
    expect(qualitySteps('best', 'unknown')).toBeNull();
  });
});

describe('resolveSteps', () => {
  it('resolves a preset by the model actually run', () => {
    expect(resolveSteps({ quality: 'best', inferenceSteps: 0 }, 'acestep-v15-turbo')).toBe(12);
    expect(resolveSteps({ quality: 'draft', inferenceSteps: 0 }, 'acestep-v15-xl-sft')).toBe(24);
    expect(resolveSteps({ quality: 'best', inferenceSteps: 0 }, 'acestep-v15-xl-base')).toBe(64);
  });

  it('sends nothing for BALANCED, leaving AUTO to the server', () => {
    expect(resolveSteps({ quality: 'balanced', inferenceSteps: 30 }, 'acestep-v15-xl-sft')).toBe(0);
  });

  it('sends the hand-set slider value for custom, whatever the model', () => {
    expect(resolveSteps({ quality: 'custom', inferenceSteps: 30 }, 'acestep-v15-turbo')).toBe(30);
    expect(resolveSteps({ quality: 'custom', inferenceSteps: 0 }, '')).toBe(0);
  });
});

describe('qualityHint', () => {
  it('names the steps a preset sends on a known model', () => {
    expect(qualityHint('best', 'turbo', 'x')).toBe('12 steps · slower, finer detail');
    expect(qualityHint('balanced', 'turbo', 'x')).toBe("AUTO steps · the model's own step count");
  });

  it('is honest that DRAFT/BEST send AUTO until the model is known, and says why', () => {
    expect(qualityHint('draft', 'unknown', "couldn't load the model list"))
      .toBe("DRAFT applies once the model is known — couldn't load the model list · AUTO steps until then");
    expect(qualityHint('balanced', 'unknown', 'x')).toBe("AUTO steps · the model's own step count");
  });

  it('points a custom count at TUNE', () => {
    expect(qualityHint('custom', 'turbo', 'x')).toContain('custom steps, set in TUNE');
  });
});

describe('migrateQuality', () => {
  it('keeps a saved quality', () => {
    expect(migrateQuality({ quality: 'best', inferenceSteps: 40 })).toBe('best');
  });

  it('turns hand-set steps into custom and AUTO steps into balanced', () => {
    expect(migrateQuality({ inferenceSteps: 40 })).toBe('custom');
    expect(migrateQuality({ inferenceSteps: 0 })).toBe('balanced');
    expect(migrateQuality(undefined)).toBe('balanced');
  });
});
