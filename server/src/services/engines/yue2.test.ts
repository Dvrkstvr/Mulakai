import { describe, it, expect } from 'vitest';
import { buildYue2CoverRequest, buildYue2Request, yue2Engine, INSTRUMENTAL_LYRICS, YUE2_CAPABILITIES } from './yue2.js';

const fixedRandom = () => 4242;
const LYRICS = '[Verse]\nsalt on the window';

describe('YuE2 request mapping', () => {
  it('maps the caption and lyrics, and always sends a seed', () => {
    expect(buildYue2Request({ prompt: ' indie pop ', lyrics: LYRICS }, fixedRandom))
      .toEqual({ style: 'indie pop', lyrics: LYRICS, seed: 4242 });
  });

  it('appends BPM / KEY / TIME SIGNATURE to the style only when they are not AUTO', () => {
    const style = (extra: object) => buildYue2Request({ prompt: 'pop', lyrics: LYRICS, ...extra }, fixedRandom).style;
    expect(style({ bpm: 92, key_scale: 'A minor', time_signature: '6' })).toBe('pop, 92 bpm, A minor, 6/8 time');
    expect(style({ bpm: 91.6 })).toBe('pop, 92 bpm');
    expect(style({ time_signature: '3/4' })).toBe('pop, 3/4 time');
    expect(style({ bpm: 0, key_scale: '  ', time_signature: '' })).toBe('pop');
    expect(style({ time_signature: 'odd' })).toBe('pop');
  });

  it('uses the given seed only when RANDOM SEED is off', () => {
    const seed = (extra: object) => buildYue2Request({ prompt: 'p', lyrics: LYRICS, ...extra }, fixedRandom).seed;
    expect(seed({ use_random_seed: false, seed: 77.9 })).toBe(77);
    expect(seed({ use_random_seed: true, seed: 77 })).toBe(4242);
    expect(seed({ seed: 77 })).toBe(4242); // absent = AUTO = random
    expect(seed({ use_random_seed: false, seed: -1 })).toBe(4242);
    expect(seed({ use_random_seed: false })).toBe(4242);
  });

  it('picks a fresh random seed per request by default, never YuE2\'s fixed 831001', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => yue2Engine.toRequest({ prompt: 'p', lyrics: LYRICS }).seed));
    expect(seeds.size).toBeGreaterThan(1);
    for (const s of seeds) expect(Number.isInteger(s) && (s as number) >= 0 && (s as number) < 2 ** 32).toBe(true);
  });

  it('sends the engine-only CFG clamped to 0-20, and ignores ACE-Step GUIDANCE', () => {
    const req = (extra: object) => buildYue2Request({ prompt: 'p', lyrics: LYRICS, ...extra }, fixedRandom);
    expect(req({ cfg: 3.5 }).cfg_scale).toBe(3.5);
    expect(req({ cfg: 25 }).cfg_scale).toBe(20);
    expect(req({ cfg: -1 }).cfg_scale).toBe(0);
    expect(req({ guidance_scale: 7 })).not.toHaveProperty('cfg_scale');
  });

  it('sends COT only when set, and drops every field YuE2 cannot take', () => {
    expect(buildYue2Request({ prompt: 'p', lyrics: LYRICS, cot: 'melody' }, fixedRandom).cot).toBe('melody');
    const req = buildYue2Request({
      prompt: 'p', lyrics: LYRICS, audio_duration: 120, vocal_language: 'de', temperature: 1.1, top_k: 50,
      output: { format: 'flac' },
    }, fixedRandom);
    expect(Object.keys(req).sort()).toEqual(['lyrics', 'seed', 'style']);
  });

  it('turns empty lyrics into a tags-only skeleton and upstream\'s instrumental style', () => {
    for (const lyrics of [undefined, '', '  \n ']) {
      const req = buildYue2Request({ prompt: 'lo-fi', lyrics, bpm: 80 }, fixedRandom);
      expect(req.lyrics).toBe(INSTRUMENTAL_LYRICS);
      expect(req.style).toBe('Instrumental, lo-fi, 80 bpm, no vocals, no singing, no choir, no spoken words');
    }
    expect(INSTRUMENTAL_LYRICS.replace(/\[[^\]]+\]/g, '').trim()).toBe('');
  });

  it('does not repeat what an instrumental prompt already says, and skips the language', () => {
    expect(buildYue2Request({ prompt: 'Instrumental jazz, no vocals', vocal_language: 'en' }, fixedRandom).style)
      .toBe('Instrumental jazz, no vocals, no singing, no choir, no spoken words');
    expect(buildYue2Request({}, fixedRandom).style).toBe('Instrumental, no vocals, no singing, no choir, no spoken words');
  });

  it('puts VOCAL LANGUAGE first in the style, for the two languages YuE2 sings', () => {
    const style = (vocal_language?: string) =>
      buildYue2Request({ prompt: 'pop', lyrics: LYRICS, bpm: 90, vocal_language }, fixedRandom).style;
    expect(style('en')).toBe('English, pop, 90 bpm');
    expect(style('zh')).toBe('Chinese, pop, 90 bpm');
    expect(style('de')).toBe('pop, 90 bpm');
    expect(style()).toBe('pop, 90 bpm');
  });

  it('refuses a request with no style at all, in Create terms', () => {
    expect(() => buildYue2Request({ prompt: '  ', lyrics: LYRICS }, fixedRandom)).toThrow(/needs a PROMPT/);
    expect(buildYue2Request({ lyrics: LYRICS, bpm: 100 }, fixedRandom).style).toBe('100 bpm');
  });
});

describe('YuE2 cover request', () => {
  const ABC = 'X:1\nM:4/4\nQ:1/4=75\nK:Fm\n% verse\nV: Vocal\nC8|\n';

  it('sends the score with cot melody, and drops the tempo/key/meter hints the score fixes', () => {
    const req = buildYue2CoverRequest({
      prompt: 'folk', lyrics: LYRICS, bpm: 120, key_scale: 'C major', time_signature: '3', vocal_language: 'en',
      cot: 'full', cfg: 1.2, use_random_seed: false, seed: 9,
    }, ABC, fixedRandom);
    expect(req).toEqual({ style: 'English, folk', lyrics: LYRICS, seed: 9, cfg_scale: 1.2, cot: 'melody', abc: ABC });
  });

  it('keeps the tags-only skeleton for an instrumental cover, which yue-server re-tags from the score', () => {
    const req = buildYue2CoverRequest({ prompt: 'cello', lyrics: '' }, ABC, fixedRandom);
    expect(req.lyrics).toBe(INSTRUMENTAL_LYRICS);
    expect(req.style).toBe('Instrumental, cello, no vocals, no singing, no choir, no spoken words');
    expect(yue2Engine.toCoverRequest?.({ prompt: 'p', lyrics: LYRICS }, ABC)).toMatchObject({ abc: ABC, cot: 'melody' });
  });
});

describe('YuE2 descriptor', () => {
  it('states what YuE2 cannot do, with the consequence line from the spec', () => {
    expect(YUE2_CAPABILITIES).toMatchObject({
      duration: 'none', musicalMeta: 'style-text', referenceAudio: false, adapters: false, seed: true,
      languages: ['en', 'zh'], lmTools: false, advanced: false, takes: false, instrumental: true, extraControls: ['cfg', 'cot'],
    });
    expect(YUE2_CAPABILITIES.consequence).toContain('no section strip');
    expect(yue2Engine.readMeta({ score: 'X:1\nQ:1/4=84\nK:Dm\n|A2|' }))
      .toEqual({ bpm: 84, keyScale: 'D minor', timeSignature: '' });
    expect(yue2Engine.readMeta({})).toEqual({ bpm: null, keyScale: '', timeSignature: '' });
  });
});
