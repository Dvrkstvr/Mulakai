import { describe, it, expect, vi, afterEach } from 'vitest';
import { modelFamily, stepsForModel, resolveInferenceSteps } from './inferenceSteps.js';
import type { ReleaseTaskParams } from './acestep.js';

process.env.ACESTEP_API_URL = 'http://acestep.test';

/** Stub /v1/model_inventory's shape so the AUTO-model branch can be driven. */
function mockInventory(defaultModel: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(
      JSON.stringify({ data: { models: [], lm_models: [], default_model: defaultModel } }),
      { status: 200 },
    )),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('modelFamily', () => {
  it('classifies the real checkpoint names', () => {
    expect(modelFamily('acestep-v15-xl-turbo')).toBe('turbo');
    expect(modelFamily('acestep-v15-turbo-shift3')).toBe('turbo');
    expect(modelFamily('turbo-continuous')).toBe('turbo');
    expect(modelFamily('acestep-v15-xl-sft')).toBe('sft');
    expect(modelFamily('acestep-v15-base')).toBe('other');
    expect(modelFamily('acestep-v15-xl-base')).toBe('other');
  });

  it('matches delimited tokens, not substrings', () => {
    // The whole point of the token regex: a custom LoRA whose name merely contains
    // "turbo" must not be treated as a distilled checkpoint and dropped to 8 steps.
    expect(modelFamily('turbocharged-rock')).toBe('other');
    expect(modelFamily('my-softer-mix')).toBe('other');
  });

  it('treats path and dot separators as delimiters', () => {
    expect(modelFamily('models/acestep-v15-sft/')).toBe('sft');
    expect(modelFamily('acestep_v15.turbo.safetensors')).toBe('turbo');
  });

  it('is case-insensitive', () => {
    expect(modelFamily('ACEStep-V15-XL-Turbo')).toBe('turbo');
  });

  it('returns null for an absent name', () => {
    expect(modelFamily('')).toBeNull();
    expect(modelFamily(undefined)).toBeNull();
    expect(modelFamily(null)).toBeNull();
  });

  it('reads turbo before sft', () => {
    expect(modelFamily('acestep-turbo-sft')).toBe('turbo');
  });
});

describe('stepsForModel', () => {
  it('maps each family to PR #1223s table', () => {
    expect(stepsForModel('acestep-v15-xl-turbo')).toBe(8);
    expect(stepsForModel('acestep-v15-xl-sft')).toBe(50);
    expect(stepsForModel('acestep-v15-base')).toBe(32);
    expect(stepsForModel('')).toBeNull();
  });
});

describe('resolveInferenceSteps', () => {
  it('fills from an explicitly selected model without touching the network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('should not be called'); }));
    const params: ReleaseTaskParams = { model: 'acestep-v15-xl-sft' };

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(50);
  });

  it('leaves an explicit step count alone', async () => {
    // remasterJobs.ts always sets its own steps — this is what protects it.
    const params: ReleaseTaskParams = { model: 'acestep-v15-xl-sft', inference_steps: 100 };

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(100);
  });

  it('treats a non-positive count as unset', async () => {
    const params: ReleaseTaskParams = { model: 'acestep-v15-base', inference_steps: 0 };

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(32);
  });

  it('classifies the inventory default under AUTO model', async () => {
    mockInventory('acestep-v15-base');
    const params: ReleaseTaskParams = {};

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(32);
  });

  it('falls back to ACE-Steps own default when the inventory names no default', async () => {
    mockInventory(null);
    const params: ReleaseTaskParams = {};

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(8);
  });

  it('falls back to ACE-Steps own default when the inventory is unreachable', async () => {
    // listModels() swallows transport errors into an empty inventory, so an ACE-Step
    // that is down must not change the number we send — it must stay legacy behaviour.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const params: ReleaseTaskParams = {};

    await resolveInferenceSteps(params);

    expect(params.inference_steps).toBe(8);
  });
});
