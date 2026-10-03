import { describe, it, expect, beforeEach } from 'vitest';
import type { EngineCapabilities } from './api';
import { coverParams, enginePromptParams, type PromptIntent } from './engineRequest';
import { AUTO_CONTROLS, controlRange, controlsFor, engineFields, useEngineSettings } from './engineSettings';

const YUE2: EngineCapabilities = {
  duration: 'none', musicalMeta: 'style-text', referenceAudio: false, adapters: false, seed: true,
  languages: ['en', 'zh'], sectionTags: null, lmTools: false, advanced: false, takes: false,
  instrumental: true, extraControls: ['cfg', 'cot'], consequence: 'YuE2 · …',
};
const HEARTMULA: EngineCapabilities = {
  ...YUE2, duration: 'max', musicalMeta: 'none', seed: false, instrumental: false, extraControls: ['cfg', 'temperature', 'topK'],
};
const DRAFT: PromptIntent = {
  title: '', prompt: 'indie pop', lyrics: '[Verse]\nla', bpm: 92, keyScale: 'A minor', timeSignature: '6',
  vocalLanguage: 'de', duration: 120, folderId: 'f1',
};
const SEED = { randomSeed: false, seed: 7 };

describe('enginePromptParams', () => {
  it('asks YuE2 for an instrumental its own way: blank LYRICS, not the ACE-Step tag', () => {
    expect(enginePromptParams({ ...DRAFT, lyrics: '[Instrumental]' }, YUE2, SEED, AUTO_CONTROLS, null).lyrics).toBe('');
    expect(enginePromptParams(DRAFT, YUE2, SEED, AUTO_CONTROLS, null).lyrics).toBe('[Verse]\nla');
  });

  it('never blanks LYRICS for an engine without an instrumental mode (HeartMuLa 422s blank lyrics)', () => {
    expect(enginePromptParams({ ...DRAFT, lyrics: '[Instrumental]' }, HEARTMULA, SEED, AUTO_CONTROLS, null).lyrics).toBe('[Instrumental]');
  });

  it('sends YuE2 only what it takes: style-text details, the seed pair and its own controls', () => {
    const params = enginePromptParams(DRAFT, YUE2, SEED, { ...AUTO_CONTROLS, cfg: 1.5, cot: 'melody', temperature: 0.9 }, { f: 'flac' });
    expect(params).toEqual({
      title: 'Untitled', prompt: 'indie pop', lyrics: '[Verse]\nla',
      bpm: 92, key_scale: 'A minor', time_signature: '6',
      use_random_seed: false, seed: 7,
      cfg: 1.5, cot: 'melody',
      output: { f: 'flac' }, folder_id: 'f1',
    });
  });

  it('sends YuE2 a VOCAL LANGUAGE it sings, as a style-text detail', () => {
    expect(enginePromptParams({ ...DRAFT, vocalLanguage: 'zh' }, YUE2, SEED, AUTO_CONTROLS, {}).vocal_language).toBe('zh');
    expect(enginePromptParams({ ...DRAFT, vocalLanguage: 'zh' }, HEARTMULA, SEED, AUTO_CONTROLS, {}))
      .not.toHaveProperty('vocal_language');
  });

  it('never sends GUIDANCE, a vocal language YuE2 doesn\'t sing, or a duration it ignores', () => {
    const params = enginePromptParams(DRAFT, YUE2, SEED, AUTO_CONTROLS, {});
    for (const key of ['guidance_scale', 'vocal_language', 'audio_duration', 'lm_model_path', 'thinking']) {
      expect(params).not.toHaveProperty(key);
    }
  });

  it('sends HeartMuLa its duration cap and no seed or musical metadata', () => {
    const params = enginePromptParams(DRAFT, HEARTMULA, SEED, { ...AUTO_CONTROLS, topK: 50 }, {});
    expect(params).toMatchObject({ audio_duration: 120, top_k: 50 });
    for (const key of ['bpm', 'key_scale', 'time_signature', 'use_random_seed', 'seed']) expect(params).not.toHaveProperty(key);
  });

  it('leaves the seed out when RANDOM SEED is on, but still says so', () => {
    const params = enginePromptParams(DRAFT, YUE2, { randomSeed: true, seed: 7 }, AUTO_CONTROLS, {});
    expect(params.use_random_seed).toBe(true);
    expect(params).not.toHaveProperty('seed');
  });
});

describe('engine controls', () => {
  beforeEach(() => useEngineSettings.setState({ values: {} }));

  it('maps only the controls the engine lists, and only when not AUTO', () => {
    const all = { cfg: 2, temperature: 1.1, topK: 40, cot: 'off' as const };
    expect(engineFields(YUE2, all)).toEqual({ cfg: 2, cot: 'off' });
    expect(engineFields(HEARTMULA, all)).toEqual({ cfg: 2, temperature: 1.1, top_k: 40 });
    expect(engineFields(YUE2, AUTO_CONTROLS)).toEqual({});
  });

  it('keeps each engine\'s values apart', () => {
    useEngineSettings.getState().set('yue2', { cfg: 3 });
    useEngineSettings.getState().set('heartmula', { cfg: 1.5 });
    useEngineSettings.getState().set('yue2', { cot: 'melody' });
    expect(controlsFor(useEngineSettings.getState(), 'yue2')).toEqual({ ...AUTO_CONTROLS, cfg: 3, cot: 'melody' });
    expect(controlsFor(useEngineSettings.getState(), 'heartmula').cfg).toBe(1.5);
  });

  it('uses each engine\'s own slider range', () => {
    expect(controlRange('yue2', 'cfg')).toEqual({ min: 0, max: 3, step: 0.05 });
    expect(controlRange('heartmula', 'cfg').max).toBe(10);
    expect(controlRange('acestep', 'temperature')).toEqual({ min: 0, max: 2, step: 0.05 });
  });
});

describe('coverParams', () => {
  it('sends the score and its source, and none of what the score fixes', () => {
    const params = coverParams(
      { title: 'Folk Ellies', prompt: 'folk', lyrics: '[Verse]\nla', vocalLanguage: 'en', folderId: 'f1' },
      YUE2, SEED, { ...AUTO_CONTROLS, cfg: 1.2, cot: 'full' }, { f: 'flac' }, { abc: 'X:1\n', source: 'Ellies City 2' },
    );
    expect(params).toEqual({
      title: 'Folk Ellies', prompt: 'folk', lyrics: '[Verse]\nla', vocal_language: 'en',
      use_random_seed: false, seed: 7, cfg: 1.2, output: { f: 'flac' }, folder_id: 'f1',
      abc: 'X:1\n', source: 'Ellies City 2',
    });
  });
});
