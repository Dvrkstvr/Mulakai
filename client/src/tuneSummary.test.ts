import { describe, it, expect } from 'vitest';
import { tuneSummary } from './tuneSummary';

const knobs = { inferenceSteps: 0, guidanceScale: 0, randomSeed: true, seed: 42 };

describe('tuneSummary', () => {
  it('reads all-default knobs on AUTO model', () => {
    expect(tuneSummary('', knobs)).toBe('auto model · steps auto · guidance auto · seed random');
  });

  it('names the family and says guidance is N/A on Turbo', () => {
    expect(tuneSummary('acestep-v15-turbo', { ...knobs, guidanceScale: 7 })).toBe('turbo · steps auto · guidance n/a · seed random');
  });

  it('shows set values and a fixed seed', () => {
    expect(tuneSummary('acestep-v15-xl-sft', { inferenceSteps: 60, guidanceScale: 7, randomSeed: false, seed: 1234 }))
      .toBe('sft · steps 60 · guidance 7 · seed 1234');
  });

  it('reads a Base checkpoint as base, and anything else by its name', () => {
    expect(tuneSummary('acestep-v15-base', knobs)).toMatch(/^base · /);
    expect(tuneSummary('my-custom-dit', knobs)).toMatch(/^my-custom-dit · /);
  });
});
