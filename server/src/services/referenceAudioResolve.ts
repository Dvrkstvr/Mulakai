/**
 * Resolves a raw reference-audio buffer for cover/complete generation, from either an
 * uploaded file or a saved voice profile. Unlike text2music/lego (jobs.ts's startGeneration),
 * these never remap audio_influence/style_influence into their own params — cover already has
 * its own VARIANCE-driven audio_cover_strength (the AUDIO tab's own slider), and complete has
 * no established mapping — so a saved voice is treated as nothing more than a source of bytes
 * here, same as an ad-hoc upload.
 */
import { loadVoiceReference } from './voiceConditioning.js';

export interface RefAudioFile {
  data: Buffer;
  filename: string;
}

export async function resolveReferenceAudioFile(uploaded?: RefAudioFile, voiceId?: string): Promise<RefAudioFile | undefined> {
  if (uploaded) return uploaded;
  if (voiceId) return (await loadVoiceReference(voiceId)).referenceAudio;
  return undefined;
}
