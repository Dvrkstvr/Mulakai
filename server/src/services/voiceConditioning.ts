/** Loads a saved voice profile's audio + resolved influence values for reference-audio conditioning. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';

interface VoiceRow {
  audio_file: string;
  default_audio_influence: number;
  default_style_influence: number;
}

export interface VoiceReference {
  referenceAudio: { data: Buffer; filename: string };
  audioInfluence: number;
  styleInfluence: number;
}

/**
 * Reads the voice's audio file off disk and resolves audio/style influence,
 * preferring per-request overrides over the voice's stored defaults.
 */
export async function loadVoiceReference(
  voiceId: string,
  overrides: { audioInfluence?: number; styleInfluence?: number } = {},
): Promise<VoiceReference> {
  const voice = db
    .prepare(`SELECT audio_file, default_audio_influence, default_style_influence FROM voices WHERE id = ?`)
    .get(voiceId) as VoiceRow | undefined;
  if (!voice) throw new Error('unknown voice');

  const data = await fs.readFile(path.join(config.audioDir, voice.audio_file));
  return {
    referenceAudio: { data, filename: voice.audio_file },
    audioInfluence: overrides.audioInfluence ?? voice.default_audio_influence,
    styleInfluence: overrides.styleInfluence ?? voice.default_style_influence,
  };
}

/**
 * Applies resolved influence values to a params object in place:
 * `audio_cover_strength` maps directly from audioInfluence (both 0-1), and
 * `guidance_scale` (if the request already set an explicit, non-AUTO value)
 * is scaled by styleInfluence/0.5 and clamped to ACE-Step's 0-20 range.
 */
export function applyVoiceInfluence<T extends { audio_cover_strength?: number; guidance_scale?: number }>(
  params: T,
  ref: { audioInfluence: number; styleInfluence: number },
): T {
  params.audio_cover_strength = ref.audioInfluence;
  if (params.guidance_scale !== undefined) {
    params.guidance_scale = Math.max(0, Math.min(20, params.guidance_scale * (ref.styleInfluence / 0.5)));
  }
  return params;
}
