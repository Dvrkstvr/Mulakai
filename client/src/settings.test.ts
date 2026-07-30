import { describe, it, expect } from 'vitest';
import { genParams, repaintParams, addLayerParams, useSettings, mergeSettings, outputParams, type GenSettings } from './settings';

const baseGen = (): GenSettings => useSettings.getState().gen;
const baseRepaint = () => useSettings.getState().repaint;
const baseAddLayer = () => useSettings.getState().addLayer;

describe('genParams', () => {
  it('omits AUTO/unset advanced fields by default', () => {
    const p = genParams(baseGen());
    expect(p).not.toHaveProperty('shift');
    expect(p).not.toHaveProperty('infer_method');
    expect(p).not.toHaveProperty('timesteps');
    expect(p).not.toHaveProperty('lm_negative_prompt');
    expect(p).not.toHaveProperty('lm_top_k');
    expect(p).not.toHaveProperty('batch_size');
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

  it('includes batch_size only when TAKES is raised above AUTO (0)', () => {
    expect(genParams({ ...baseGen(), batchSize: 0 })).not.toHaveProperty('batch_size');
    expect(genParams({ ...baseGen(), batchSize: 3 }).batch_size).toBe(3);
  });
});

describe('shared advanced settings (repaint + add layer)', () => {
  it('repaintParams emits the DiT advanced knobs but no LM knobs', () => {
    const p = repaintParams({ ...baseRepaint(), useAdg: true, cfgIntervalStart: 0.2, shift: 2 });
    expect(p.use_adg).toBe(true);
    expect(p.cfg_interval_start).toBe(0.2);
    expect(p.shift).toBe(2);
    expect(p).not.toHaveProperty('lm_temperature');
    expect(p).not.toHaveProperty('lm_cfg_scale');
  });

  it('repaintParams emits repaint_wav_crossfade_sec unconditionally, including the 0 default', () => {
    expect(repaintParams(baseRepaint()).repaint_wav_crossfade_sec).toBe(0);
    expect(repaintParams({ ...baseRepaint(), crossfadeSec: 1.5 }).repaint_wav_crossfade_sec).toBe(1.5);
  });

  it('addLayerParams takes steps/seed from the shared repaint slice and emits DiT + LM knobs', () => {
    const r = { ...baseRepaint(), inferenceSteps: 40, randomSeed: false, seed: 7, useAdg: true, lmTopK: 30 };
    const p = addLayerParams({ ...baseAddLayer(), model: 'acestep-v15-xl-base' }, r);
    expect(p.model).toBe('acestep-v15-xl-base');
    expect(p.inference_steps).toBe(40);
    expect(p.use_random_seed).toBe(false);
    expect(p.seed).toBe(7);
    expect(p.use_adg).toBe(true);       // DiT advanced shared from repaint
    expect(p.lm_temperature).toBe(0.85); // LM knobs emitted (lego runs the LM)
    expect(p.lm_top_k).toBe(30);
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

describe('export format migration', () => {
  const base = useSettings.getState();

  const merged = (persistedExport: Record<string, unknown>) =>
    mergeSettings(base, { exportSettings: persistedExport }).exportSettings;

  it('turns the legacy wav32 pseudo-format into wav at 32-bit float', () => {
    const e = merged({ audioFormat: 'wav32' });
    expect(e.audioFormat).toBe('wav');
    expect(e.bitDepth).toBe(32);
  });

  it('moves dropped lossy formats to lossless, not to mp3', () => {
    for (const legacy of ['opus', 'aac']) {
      const e = merged({ audioFormat: legacy });
      expect(e.audioFormat).toBe('flac');
      expect(e.bitDepth).toBe(24);
    }
  });

  it('re-clamps a depth the persisted container cannot hold', () => {
    expect(merged({ audioFormat: 'flac', bitDepth: 32 }).bitDepth).toBe(24);
  });

  it('leaves a valid pair alone', () => {
    const e = merged({ audioFormat: 'wav', bitDepth: 24 });
    expect(e.audioFormat).toBe('wav');
    expect(e.bitDepth).toBe(24);
  });

  it('defaults to lossless FLAC at its highest depth', () => {
    expect(base.exportSettings.audioFormat).toBe('flac');
    expect(base.exportSettings.bitDepth).toBe(24);
    expect(base.exportSettings.sampleRate).toBe(48000);
    expect(base.exportSettings.mp3Bitrate).toBe(320);
  });
});

describe('outputParams', () => {
  it('sends a clamped depth even if state drifted', () => {
    expect(outputParams({ ...useSettings.getState().exportSettings, audioFormat: 'flac', bitDepth: 32 }).bitDepth).toBe(24);
  });
});

describe('ACE-Step wire format', () => {
  it('always asks for the lossless master regardless of the chosen format', () => {
    useSettings.getState().setExportSettings({ audioFormat: 'mp3' });
    expect(genParams(useSettings.getState().gen).audio_format).toBe('wav32');
    expect(repaintParams(useSettings.getState().repaint).audio_format).toBe('wav32');
  });

  it('carries the user format in the output block instead', () => {
    useSettings.getState().setExportSettings({ audioFormat: 'mp3', mp3Bitrate: 320 });
    expect(genParams(useSettings.getState().gen).output).toMatchObject({ format: 'mp3', mp3Bitrate: 320 });
  });
});
