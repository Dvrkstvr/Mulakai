import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { loadVoiceReference, applyVoiceInfluence } = await import('./voiceConditioning.js');

function seedVoice(overrides: Partial<{ default_audio_influence: number; default_style_influence: number }> = {}) {
  const id = crypto.randomUUID();
  const filename = `${id}.mp3`;
  fs.writeFileSync(path.join(config.audioDir, filename), 'fake voice audio');
  db.prepare(
    `INSERT INTO voices (id, name, audio_file, default_audio_influence, default_style_influence)
     VALUES (?, 'Test Voice', ?, ?, ?)`,
  ).run(id, filename, overrides.default_audio_influence ?? 0.5, overrides.default_style_influence ?? 0.5);
  return id;
}

describe('loadVoiceReference', () => {
  it('resolves the voice\'s stored defaults when no overrides are given', async () => {
    const id = seedVoice({ default_audio_influence: 0.7, default_style_influence: 0.3 });
    const ref = await loadVoiceReference(id);
    expect(ref.audioInfluence).toBe(0.7);
    expect(ref.styleInfluence).toBe(0.3);
    expect(ref.referenceAudio.data.toString()).toBe('fake voice audio');
  });

  it('prefers per-request overrides over stored defaults', async () => {
    const id = seedVoice({ default_audio_influence: 0.7, default_style_influence: 0.3 });
    const ref = await loadVoiceReference(id, { audioInfluence: 0.2, styleInfluence: 0.9 });
    expect(ref.audioInfluence).toBe(0.2);
    expect(ref.styleInfluence).toBe(0.9);
  });

  it('throws for an unknown voice id', async () => {
    await expect(loadVoiceReference('nope')).rejects.toThrow('unknown voice');
  });
});

describe('applyVoiceInfluence', () => {
  it('maps audioInfluence directly to audio_cover_strength', () => {
    const params = applyVoiceInfluence({}, { audioInfluence: 0.65, styleInfluence: 0.5 });
    expect(params.audio_cover_strength).toBe(0.65);
  });

  it('leaves guidance_scale untouched when AUTO (undefined)', () => {
    const params = applyVoiceInfluence({}, { audioInfluence: 0.5, styleInfluence: 1 });
    expect(params.guidance_scale).toBeUndefined();
  });

  it('scales an explicit guidance_scale by styleInfluence/0.5, clamped to 0-20', () => {
    const doubled = applyVoiceInfluence({ guidance_scale: 7 }, { audioInfluence: 0.5, styleInfluence: 1 });
    expect(doubled.guidance_scale).toBe(14);

    const zeroed = applyVoiceInfluence({ guidance_scale: 7 }, { audioInfluence: 0.5, styleInfluence: 0 });
    expect(zeroed.guidance_scale).toBe(0);

    const clamped = applyVoiceInfluence({ guidance_scale: 18 }, { audioInfluence: 0.5, styleInfluence: 1.5 });
    expect(clamped.guidance_scale).toBe(20);
  });
});
