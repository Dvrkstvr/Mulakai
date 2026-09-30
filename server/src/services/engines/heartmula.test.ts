import { describe, it, expect } from 'vitest';
import {
  AUTO_MAX_AUDIO_LENGTH_MS, HEARTMULA_CAPABILITIES, captionToTags, heartmula, toHeartmulaRequest,
} from './heartmula.js';

describe('captionToTags', () => {
  it.each([
    ['dreamy synth pop', 'dreamy-synth-pop'],
    ['Piano, Happy ,wedding', 'piano,happy,wedding'],
    ['Dreamy synth pop; Female  vocals', 'dreamy-synth-pop,female-vocals'],
    ['rock\nfast tempo', 'rock,fast-tempo'],
    ['lo-fi, , ;lo-fi, Lo-Fi', 'lo-fi'],
    ['Warm pads.', 'warm-pads'],
    ['', ''],
    [' , ; ', ''],
  ])('%j -> %j', (caption, tags) => {
    expect(captionToTags(caption)).toBe(tags);
  });
});

describe('toHeartmulaRequest', () => {
  it('maps caption, lyrics, and sends the 240 s cap on AUTO duration', () => {
    expect(toHeartmulaRequest({ prompt: 'Synth pop', lyrics: '[Verse]\nla la' })).toEqual({
      tags: 'synth-pop', lyrics: '[Verse]\nla la', max_audio_length_ms: AUTO_MAX_AUDIO_LENGTH_MS,
    });
    expect(AUTO_MAX_AUDIO_LENGTH_MS).toBe(240_000);
  });

  it('turns DURATION seconds into a cap within the wrapper range', () => {
    expect(toHeartmulaRequest({ audio_duration: 185.5 }).max_audio_length_ms).toBe(185_500);
    expect(toHeartmulaRequest({ audio_duration: 3 }).max_audio_length_ms).toBe(10_000);
    expect(toHeartmulaRequest({ audio_duration: 900 }).max_audio_length_ms).toBe(360_000);
    expect(toHeartmulaRequest({ audio_duration: 0 }).max_audio_length_ms).toBe(240_000);
  });

  it('sends the engine controls only when set, clamped to what the wrapper accepts', () => {
    expect(toHeartmulaRequest({ cfg: 2, temperature: 0.9, top_k: 40.4 })).toMatchObject(
      { cfg_scale: 2, temperature: 0.9, topk: 40 },
    );
    expect(toHeartmulaRequest({ cfg: 25, temperature: 5, top_k: 5000 })).toMatchObject(
      { cfg_scale: 10, temperature: 2, topk: 1000 },
    );
    expect(toHeartmulaRequest({ cfg: 0.5 })).toMatchObject({ cfg_scale: 1 });
    const auto = toHeartmulaRequest({ cfg: 0, temperature: 0, top_k: 0 });
    expect(auto).not.toHaveProperty('cfg_scale');
    expect(auto).not.toHaveProperty('temperature');
    expect(auto).not.toHaveProperty('topk');
  });

  it('drops everything HeartMuLa has no input for, GUIDANCE included', () => {
    const request = toHeartmulaRequest({
      prompt: 'pop', lyrics: 'la', bpm: 120, key_scale: 'A minor', time_signature: '4',
      vocal_language: 'en', guidance_scale: 7, use_random_seed: false, seed: 42, cot: 'full', output: { format: 'mp3' },
    });
    expect(Object.keys(request).sort()).toEqual(['lyrics', 'max_audio_length_ms', 'tags']);
  });

  it('passes lyrics through untouched and sends empty ones for the wrapper to refuse', () => {
    const lyrics = '[Chorus]\n[soft voice] Oh, OH;  oh\n';
    expect(toHeartmulaRequest({ lyrics }).lyrics).toBe(lyrics);
    expect(toHeartmulaRequest({}).lyrics).toBe('');
  });
});

describe('heartmula engine', () => {
  it('describes a capped, seedless, reference-free model with its own controls', () => {
    expect(HEARTMULA_CAPABILITIES).toMatchObject({
      duration: 'max', musicalMeta: 'none', referenceAudio: false, adapters: false, seed: false,
      lmTools: false, advanced: false, takes: false, extraControls: ['cfg', 'temperature', 'topK'],
      languages: ['zh', 'en', 'ja', 'ko', 'es'],
      sectionTags: ['Intro', 'Verse', 'Prechorus', 'Chorus', 'Bridge', 'Outro'],
    });
    expect(HEARTMULA_CAPABILITIES.consequence).toMatch(/later edits use ACE-Step/);
    expect(heartmula).toMatchObject({ id: 'heartmula', label: 'HEARTMULA' });
  });

  it('reads no musical metadata, since HeartMuLa returns no score', () => {
    expect(heartmula.readMeta({})).toEqual({ bpm: null, keyScale: '', timeSignature: '' });
  });
});
