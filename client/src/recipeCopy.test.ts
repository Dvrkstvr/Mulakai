import { describe, expect, it } from 'vitest';
import { aceTuneChanges, engineNote, engineTuneChanges, etaLabel, recipeEtaKey, tuneSummary } from './recipeCopy';

const ace = {
  model: '', defaultModel: '', customSteps: null, guidance: 0, guidanceLive: true, randomSeed: true, seed: 0,
};

describe('engineNote', () => {
  it('says ARRANGE is always ACE-Step', () => {
    expect(engineNote('complete', null)).toBe('arranging always runs on ACE-Step');
  });

  it('names the extra engine on AN IDEA and A SONG I HAVE', () => {
    expect(engineNote('prompt', 'YUE2')).toContain('YUE2 makes the first take');
    expect(engineNote('audio', 'YUE2')).toContain('YUE2 sings');
    expect(engineNote('audio', null)).toBe('ACE-Step restyles the whole recording');
  });
});

describe('etaLabel', () => {
  it('hides the row until a sample exists', () => {
    expect(etaLabel(null)).toBeNull();
    expect(etaLabel(45_000)).toBe('45 s');
  });

  it('reads a multi-step engine cover as a few minutes', () => {
    expect(etaLabel(null, 3)).toBe('a few min · 3 steps');
    expect(etaLabel(60_000, 2)).toBe('a few min · 2 steps');
  });
});

describe('TUNE summary', () => {
  it('reads all default with nothing changed', () => {
    expect(tuneSummary(aceTuneChanges(ace), 'model, steps, guidance, seed')).toBe('model, steps, guidance, seed · all default');
  });

  it('names only the non-defaults', () => {
    const changed = aceTuneChanges({ ...ace, model: 'ACESTEP-V15-XL-SFT', customSteps: 40, guidance: 7, randomSeed: false, seed: 12 });
    expect(tuneSummary(changed, 'x')).toBe('acestep-v15-xl-sft · 40 steps · guidance 7 · seed 12');
  });

  it('leaves out the flow default model and a guidance the model ignores', () => {
    expect(aceTuneChanges({ ...ace, model: 'sft', defaultModel: 'sft', guidance: 7, guidanceLive: false })).toEqual([]);
  });

  it('names a hand-set AUTO steps as custom', () => {
    expect(aceTuneChanges({ ...ace, customSteps: 0 })).toEqual(['auto steps']);
  });

  it('names an extra engine\'s controls off AUTO and a fixed seed it can take', () => {
    const values = { cfg: 0, temperature: 1.2, topK: 0, cot: 'melody' };
    expect(engineTuneChanges(['cfg', 'temperature', 'cot'], values, { live: true, random: false, value: 7 }))
      .toEqual(['temperature 1.2', 'cot melody', 'seed 7']);
    expect(engineTuneChanges(['cfg'], values, { live: false, random: false, value: 7 })).toEqual([]);
  });
});

describe('recipeEtaKey', () => {
  it('buckets ACE-Step by task, model family and quality', () => {
    expect(recipeEtaKey('prompt', 'acestep', 'acestep-v15-turbo', 'best')).toBe('text2music|acestep|turbo|best');
    expect(recipeEtaKey('complete', 'acestep', 'acestep-v15-xl-base', 'balanced')).toBe('complete|acestep|other|balanced');
  });

  it('buckets an extra engine by task alone', () => {
    expect(recipeEtaKey('audio', 'yue2', 'acestep-v15-xl-sft', 'best')).toBe('cover|yue2|na|na');
  });
});
