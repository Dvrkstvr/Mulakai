/**
 * HeartMuLa as an extra first-take engine (PLAN.md "Engine: HeartMuLa"). It runs behind
 * heartmula-server/, whose POST /v1/jobs body keeps heartlib's own field names: `tags`,
 * `lyrics`, `max_audio_length_ms`, `cfg_scale`, `temperature`, `topk`. It returns no
 * score, so there is no musical metadata to read back.
 */
import { config } from '../../config.js';
import type { CreateFields, EngineCapabilities, SongEngine, SongMeta } from './types.js';

/** heartlib's CLI default. The pipeline's own 2-minute default cut songs short in the spike. */
export const AUTO_MAX_AUDIO_LENGTH_MS = 240_000;
/** heartmula-server's accepted ranges; a value outside them would 422 the whole job. */
const MAX_LENGTH_MS = { min: 10_000, max: 360_000 };
const CFG = { min: 1, max: 10 };
const TEMPERATURE = { min: 0.05, max: 2 };
const TOP_K = { min: 1, max: 1000 };

export const HEARTMULA_CAPABILITIES: EngineCapabilities = {
  duration: 'max',
  musicalMeta: 'none',
  referenceAudio: false,
  adapters: false,
  seed: false,
  languages: ['zh', 'en', 'ja', 'ko', 'es'],
  sectionTags: ['Intro', 'Verse', 'Prechorus', 'Chorus', 'Bridge', 'Outro'],
  lmTools: false,
  advanced: false,
  takes: false,
  instrumental: false, // no instrumental mode, and blank lyrics 422 (PLAN.md "Engine: HeartMuLa")
  // Not GUIDANCE: that slider is ACE-Step's (0.5-15) and persists across engines, so a
  // value tuned for ACE-Step would land far outside HeartMuLa's range (default 1.5).
  extraControls: ['cfg', 'temperature', 'topK'],
  consequence:
    'HeartMuLa · max length only, no seed, no reference voice, no bpm/key control, ' +
    'no section strip · ~real time on an RTX 4080 · later edits use ACE-Step',
};

/**
 * PROMPT caption -> HeartMuLa's comma-separated, space-free tag list (v1, mechanical):
 * split on `,` / `;` / newlines, lowercase, join the words inside a tag with `-`, drop
 * empties and repeats. `Dreamy synth pop; Female vocals` -> `dreamy-synth-pop,female-vocals`.
 */
export function captionToTags(caption: string): string {
  const tags = caption
    .split(/[,;\n]/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/^[-.]+|[-.]+$/g, ''))
    .filter(Boolean);
  return [...new Set(tags)].join(',');
}

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));
/** Mulakai's AUTO convention: absent, or 0 on a slider. */
const isSet = (v: number | undefined): v is number => v !== undefined && v > 0;

export function toHeartmulaRequest(fields: CreateFields): Record<string, unknown> {
  const request: Record<string, unknown> = {
    tags: captionToTags(fields.prompt ?? ''),
    lyrics: fields.lyrics ?? '',
    // DURATION is a cap here, not a target; AUTO still sends one (see AUTO_MAX_AUDIO_LENGTH_MS).
    max_audio_length_ms: isSet(fields.audio_duration)
      ? clamp(Math.round(fields.audio_duration * 1000), MAX_LENGTH_MS)
      : AUTO_MAX_AUDIO_LENGTH_MS,
  };
  if (isSet(fields.cfg)) request.cfg_scale = clamp(fields.cfg, CFG);
  if (isSet(fields.temperature)) request.temperature = clamp(fields.temperature, TEMPERATURE);
  if (isSet(fields.top_k)) request.topk = Math.round(clamp(fields.top_k, TOP_K));
  return request;
}

const NO_META: SongMeta = { bpm: null, keyScale: '', timeSignature: '' };

export const heartmula: SongEngine = {
  id: 'heartmula',
  label: 'HEARTMULA',
  url: config.heartmulaUrl,
  apiKey: config.heartmulaApiKey,
  capabilities: HEARTMULA_CAPABILITIES,
  toRequest: toHeartmulaRequest,
  readMeta: () => ({ ...NO_META }),
};
