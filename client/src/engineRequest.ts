/** The body GENERATE posts to `/api/engines/:id/generate`: Create field names, as the server's
 * pickCreateFields reads them. A control the engine can't take is left out rather than sent
 * and ignored, so a version's recorded params only hold what reached the engine. Never
 * GUIDANCE, the LM knobs or a reference voice — those are ACE-Step's. */
import type { EngineCapabilities } from './api';
import { liveLanguage, unsupported } from './engineCaps';
import { engineFields, type EngineControlValues } from './engineSettings';

export interface PromptIntent {
  title: string;
  prompt: string;
  lyrics: string;
  bpm: number;
  keyScale: string;
  timeSignature: string;
  vocalLanguage: string;
  duration: number;
  folderId?: string;
}

export function enginePromptParams(
  d: PromptIntent,
  caps: EngineCapabilities,
  seed: { randomSeed: boolean; seed: number },
  controls: EngineControlValues,
  output: unknown,
): { title: string; prompt: string; lyrics: string } & Record<string, unknown> {
  const live = (f: Parameters<typeof unsupported>[0]) => !unsupported(f, caps);
  return {
    title: d.title || 'Untitled',
    prompt: d.prompt,
    lyrics: d.lyrics,
    ...(live('bpm') && d.bpm > 0 ? { bpm: d.bpm } : {}),
    ...(live('keyScale') && d.keyScale ? { key_scale: d.keyScale } : {}),
    ...(live('timeSignature') && d.timeSignature ? { time_signature: d.timeSignature } : {}),
    ...(liveLanguage(d.vocalLanguage, caps) ? { vocal_language: d.vocalLanguage } : {}),
    ...(live('duration') && d.duration > 0 ? { audio_duration: d.duration } : {}),
    ...(caps.seed ? { use_random_seed: seed.randomSeed, ...(seed.randomSeed ? {} : { seed: seed.seed }) } : {}),
    ...engineFields(caps, controls),
    output,
    ...(d.folderId ? { folder_id: d.folderId } : {}),
  };
}
