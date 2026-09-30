/**
 * The Create fields an extra engine may map, under the same names `POST /api/generate` takes
 * (PLAN.md "Multiple Song-Creation Engines"). Shared by engines.ts and engineCovers.ts.
 */
import type { CreateFields } from '../services/engines/types.js';

const STRING_FIELDS = ['prompt', 'lyrics', 'key_scale', 'time_signature', 'vocal_language'] as const;
const NUMBER_FIELDS = ['bpm', 'audio_duration', 'guidance_scale', 'seed', 'cfg', 'temperature', 'top_k'] as const;
const COT_VALUES = new Set(['full', 'melody', 'off']);

/** The Create fields an engine may map, under the same names `POST /api/generate` takes.
 * Anything mistyped is dropped, which is AUTO. JSON only: no extra engine takes audio. */
export function pickCreateFields(body: Record<string, unknown>): CreateFields {
  const out: CreateFields = {};
  for (const key of STRING_FIELDS) if (typeof body[key] === 'string') out[key] = body[key];
  for (const key of NUMBER_FIELDS) {
    const v = body[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  if (typeof body.use_random_seed === 'boolean') out.use_random_seed = body.use_random_seed;
  if (typeof body.cot === 'string' && COT_VALUES.has(body.cot)) out.cot = body.cot as CreateFields['cot'];
  if (body.output !== undefined) out.output = body.output;
  return out;
}
