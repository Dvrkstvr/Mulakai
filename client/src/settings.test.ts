import { describe, it, expect } from 'vitest';
import { genParams, useSettings, mergeSettings, type GenSettings } from './settings';

const baseGen = (): GenSettings => useSettings.getState().gen;

describe('genParams', () => {
  it('omits AUTO/unset advanced fields by default', () => {
    const p = genParams(baseGen());
    expect(p).not.toHaveProperty('shift');
    expect(p).not.toHaveProperty('infer_method');
    expect(p).not.toHaveProperty('timesteps');
    expect(p).not.toHaveProperty('lm_negative_prompt');
    expect(p).not.toHaveProperty('lm_top_k');
    expect(p.use_adg).toBe(false);
    expect(p.cfg_interval_start).toBe(0);
    expect(p.cfg_interval_end).toBe(1);
    expect(p.lm_temperature).toBe(0.85);
    expect(p.lm_cfg_scale).toBe(2.5);
    expect(p.lm_top_p).toBe(0.9);
    expect(p.lm_repetition_penalty).toBe(1);
  });

  it('includes advanced fields once set', () => {
    const p = genParams({
      ...baseGen(),
      shift: 2.5,
      inferMethod: 'sde',
      timesteps: ' 0.9,0.5,0 ',
      useAdg: true,
      cfgIntervalStart: 0.1,
      cfgIntervalEnd: 0.9,
      lmNegativePrompt: ' quiet ',
      lmTopK: 40,
    });
    expect(p.shift).toBe(2.5);
    expect(p.infer_method).toBe('sde');
    expect(p.timesteps).toBe('0.9,0.5,0');
    expect(p.use_adg).toBe(true);
    expect(p.cfg_interval_start).toBe(0.1);
    expect(p.cfg_interval_end).toBe(0.9);
    expect(p.lm_negative_prompt).toBe('quiet');
    expect(p.lm_top_k).toBe(40);
  });
});

describe('mergeSettings', () => {
  it('backfills fields missing from a stale persisted blob with fresh defaults, instead of leaving them undefined', () => {
    // Simulates a localStorage entry saved before cfgIntervalStart/lmNegativePrompt/etc. existed —
    // zustand persist's default shallow merge would otherwise replace `gen` wholesale and leave
    // these undefined, which genParams() then crashes on (settings.ts's real-world bug).
    const stalePersisted = {
      gen: { model: 'acestep-v15-turbo', thinking: true },
    };
    const merged = mergeSettings(useSettings.getState(), stalePersisted);

    expect(merged.gen.model).toBe('acestep-v15-turbo'); // stale value preserved
    expect(merged.gen.thinking).toBe(true); // stale value preserved
    expect(merged.gen.lmNegativePrompt).toBe(''); // backfilled from defaults, not undefined
    expect(merged.gen.cfgIntervalStart).toBe(0); // backfilled from defaults, not undefined
    expect(() => genParams(merged.gen)).not.toThrow();
  });

  it('treats a null/undefined persisted blob (first run, no localStorage yet) as a no-op', () => {
    const merged = mergeSettings(useSettings.getState(), undefined);
    expect(merged.gen).toEqual(useSettings.getState().gen);
  });
});
