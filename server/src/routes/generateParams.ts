/** Request decoding shared by the generate routes (generate.ts, generateAudio.ts): the multer
 * upload, the ACE-Step param pick from JSON or multipart bodies, and their small helpers. */
import multer from 'multer';
import { getVoiceName } from '../services/voiceConditioning.js';
import type { ReferenceAudioMeta } from '../services/jobs.js';
import type { ReleaseTaskParams } from '../services/acestep.js';

// Memory storage: the source file is forwarded to ACE-Step, never written to our own disk —
// same setup as remaster.ts / songLayers.ts's mix uploads.
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const GEN_FIELDS: (keyof ReleaseTaskParams)[] = [
  'prompt', 'lyrics', 'model', 'lm_model_path', 'thinking', 'use_format', 'use_cot_caption',
  'use_cot_language', 'bpm', 'key_scale',
  'time_signature', 'vocal_language', 'audio_duration', 'inference_steps',
  'guidance_scale', 'use_random_seed', 'seed', 'batch_size', 'audio_format',
  'shift', 'infer_method', 'timesteps', 'use_adg', 'cfg_interval_start', 'cfg_interval_end',
  'lm_temperature', 'lm_cfg_scale', 'lm_negative_prompt', 'lm_top_k', 'lm_top_p', 'lm_repetition_penalty',
  'output',
];

/** Fields that arrive as strings over multipart form-data and need coercing back to their real type. */
const NUMERIC_FIELDS = new Set([
  'bpm', 'audio_duration', 'inference_steps', 'guidance_scale', 'seed', 'batch_size',
  'shift', 'cfg_interval_start', 'cfg_interval_end',
  'lm_temperature', 'lm_cfg_scale', 'lm_top_k', 'lm_top_p', 'lm_repetition_penalty',
]);

// Boolean('false') is truthy, so multipart booleans need an explicit string compare.
const BOOLEAN_FIELDS = new Set([
  'thinking', 'use_format', 'use_cot_caption', 'use_cot_language', 'use_random_seed', 'use_adg',
]);

/** Label-only reference-audio meta for cover/complete (influences don't apply there — see
 * referenceAudioResolve.ts). Null when no reference was used. */
export function labelOnlyReferenceMeta(refFile?: Express.Multer.File, voiceId?: string): ReferenceAudioMeta | null {
  const label = refFile ? (refFile.originalname || 'reference.wav') : voiceId ? getVoiceName(voiceId) : null;
  return label ? { label, audioInfluence: null, styleInfluence: null } : null;
}

export function pickParams(body: Record<string, unknown>): ReleaseTaskParams {
  const out: Record<string, unknown> = {};
  for (const key of GEN_FIELDS) if (body[key] !== undefined) out[key] = body[key];
  return out as ReleaseTaskParams;
}

export function pickMultipartParams(body: Record<string, unknown>): ReleaseTaskParams {
  const picked = pickParams(body);
  const out = picked as Record<string, unknown>;
  for (const key of NUMERIC_FIELDS) if (out[key] !== undefined) out[key] = Number(out[key]);
  for (const key of BOOLEAN_FIELDS) if (out[key] !== undefined) out[key] = out[key] === 'true' || out[key] === true;
  // The client sends the `output` settings object JSON-encoded (api.ts appendParams).
  if (typeof out.output === 'string') {
    try {
      out.output = JSON.parse(out.output);
    } catch {
      delete out.output; // parseOutputSettings would fall back to defaults anyway
    }
  }
  return out as ReleaseTaskParams;
}

/** Cover-only (the AUDIO tab's VARIANCE slider): kept out of GEN_FIELDS so it never reaches
 * text2music (ACE-Step neutralizes it there, upstream #1305) or complete (no documented use). */
export function withCoverStrength(params: ReleaseTaskParams, raw: unknown): ReleaseTaskParams {
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? { ...params, audio_cover_strength: Math.min(1, Math.max(0, n)) } : params;
}
