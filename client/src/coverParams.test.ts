import { describe, it, expect } from 'vitest';
import { coverParams, useSettings, type GenSettings } from './settings';

const gen = (over: Partial<GenSettings> = {}): GenSettings => ({ ...useSettings.getState().gen, ...over });
const SFT = 'acestep-v15-xl-sft';
const TURBO = 'acestep-v15-turbo';

describe('coverParams', () => {
  it('sends the rail\'s steps, guidance, seed and DiT knobs on the tab\'s model', () => {
    const p = coverParams(gen({
      model: 'prompt-tab-model', inferenceSteps: 60, guidanceScale: 7, randomSeed: false, seed: 1234,
      shift: 3, inferMethod: 'sde', useAdg: true, cfgIntervalStart: 0.1, cfgIntervalEnd: 0.9,
    }), SFT);
    expect(p).toMatchObject({
      model: SFT, inference_steps: 60, guidance_scale: 7, use_random_seed: false, seed: 1234,
      shift: 3, infer_method: 'sde', use_adg: true, cfg_interval_start: 0.1, cfg_interval_end: 0.9,
    });
  });

  it('leaves AUTO fields out and sends no seed while it is random', () => {
    const p = coverParams(gen({ inferenceSteps: 0, guidanceScale: 0, randomSeed: true, seed: 99 }), SFT);
    expect(p).not.toHaveProperty('inference_steps');
    expect(p).not.toHaveProperty('guidance_scale');
    expect(p).not.toHaveProperty('seed');
    expect(p.use_random_seed).toBe(true);
  });

  it('clamps STEPS to the cover model, since PROMPT shares the value', () => {
    expect(coverParams(gen({ inferenceSteps: 100 }), TURBO).inference_steps).toBe(20);
    expect(coverParams(gen({ inferenceSteps: 100 }), SFT).inference_steps).toBe(100);
  });

  it('asks for the lossless master and carries the user format in the output block', () => {
    useSettings.getState().setExportSettings({ audioFormat: 'mp3', mp3Bitrate: 256 });
    const p = coverParams(gen(), SFT);
    expect(p.audio_format).toBe('wav32');
    expect(p.output).toMatchObject({ format: 'mp3', mp3Bitrate: 256 });
  });

  it('sends nothing the cover task does not take: no LM knobs, THINKING/AI ENHANCE or TAKES', () => {
    const p = coverParams(gen({ batchSize: 3, thinking: true, useFormat: true, lmModel: 'lm', lmTopK: 5 }), SFT);
    for (const key of ['batch_size', 'thinking', 'use_format', 'lm_model_path', 'lm_temperature', 'lm_top_k', 'lm_cfg_scale']) {
      expect(p).not.toHaveProperty(key);
    }
  });
});
