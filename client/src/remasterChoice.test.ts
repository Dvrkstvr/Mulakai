import { describe, expect, it } from 'vitest';
import { pickRemasterModel, recommendedSteps, remasterSteps, remasterStepsHint, remasterConsequence } from './remasterChoice';

describe('recommendedSteps', () => {
  it("uses the model family's own count", () => {
    expect(recommendedSteps('acestep-v15-xl-sft')).toBe(50);
    expect(recommendedSteps('acestep-v15-sft')).toBe(50);
    expect(recommendedSteps('acestep-v15-base')).toBe(32);
  });

  it('falls back to 50 with no model picked yet', () => {
    expect(recommendedSteps('')).toBe(50);
  });
});

describe('remasterSteps', () => {
  it('sends the recommended count for 0', () => {
    expect(remasterSteps(0, 'acestep-v15-xl-sft')).toBe(50);
  });

  it('sends a hand-set count as-is', () => {
    expect(remasterSteps(100, 'acestep-v15-xl-sft')).toBe(100);
  });
});

describe('remasterStepsHint', () => {
  it('names the recommended count at 0', () => {
    expect(remasterStepsHint(0, 'acestep-v15-xl-sft')).toBe('50 recommended for acestep-v15-xl-sft');
  });

  it('compares a hand-set count with the recommended one', () => {
    expect(remasterStepsHint(100, 'acestep-v15-xl-sft')).toBe('100 steps ≈ 2× the time of the recommended 50');
    expect(remasterStepsHint(25, 'acestep-v15-xl-sft')).toBe('25 steps ≈ 0.5× the time of the recommended 50');
  });

  it('says a hand-set count equal to the recommended one is recommended', () => {
    expect(remasterStepsHint(32, 'acestep-v15-base')).toBe('32 recommended for acestep-v15-base');
  });
});

describe('pickRemasterModel', () => {
  const names = ['acestep-v15-base', 'acestep-v15-sft', 'acestep-v15-xl-sft'];

  it('keeps a remembered model that is still downloaded', () => {
    expect(pickRemasterModel(names, 'acestep-v15-sft')).toBe('acestep-v15-sft');
  });

  it('defaults to xl-sft, then the first model', () => {
    expect(pickRemasterModel(names, '')).toBe('acestep-v15-xl-sft');
    expect(pickRemasterModel(names, 'gone-model')).toBe('acestep-v15-xl-sft');
    expect(pickRemasterModel(['acestep-v15-base'], '')).toBe('acestep-v15-base');
    expect(pickRemasterModel([], '')).toBe('');
  });
});

describe('remasterConsequence', () => {
  it('names the model and steps, and warns that XL is slow', () => {
    expect(remasterConsequence('acestep-v15-xl-sft', 50)).toBe(
      'runs one ACE-Step pass over the whole mix with acestep-v15-xl-sft at 50 steps — several minutes on an XL model — and isn\'t kept',
    );
  });

  it('leaves the warning off a non-XL model', () => {
    expect(remasterConsequence('acestep-v15-sft', 50)).toBe(
      'runs one ACE-Step pass over the whole mix with acestep-v15-sft at 50 steps, and isn\'t kept',
    );
  });
});
