/** LM prompt tooling: refine, sample, or describe caption/lyrics/metadata. */
import { call } from './http.js';
import { initModel } from './models.js';
import type { FormatInputParams, FormatInputResult, SampleResult } from './types.js';

/**
 * Calls ACE-Step's `/format_input` — refines caption/lyrics via LM and returns
 * enhanced text plus any metadata the LM infers. Manually-set metadata is
 * passed as `param_obj` context only (the API's own metadata field names —
 * `key`/`language`/`duration` — differ from `release_task`'s `key_scale`/
 * `vocal_language`/`audio_duration`, so it's remapped here).
 */
export async function formatInput(params: FormatInputParams): Promise<FormatInputResult> {
  const paramObj: Record<string, unknown> = {};
  if (params.audio_duration) paramObj.duration = params.audio_duration;
  if (params.bpm) paramObj.bpm = params.bpm;
  if (params.key_scale) paramObj.key = params.key_scale;
  if (params.time_signature) paramObj.time_signature = params.time_signature;
  if (params.vocal_language) paramObj.language = params.vocal_language;
  return call('/format_input', {
    prompt: params.prompt ?? '',
    lyrics: params.lyrics ?? '',
    temperature: params.temperature ?? 0.85,
    param_obj: JSON.stringify(paramObj),
  });
}

/**
 * Calls ACE-Step's `/create_random_sample` — a random pre-loaded example for form filling.
 * docs/en/API.md #7 documents a single unified shape, but the live server returns two very
 * different payloads depending on `sample_type` (verified against the running instance and
 * `examples/simple_mode|text2music/*.json`, not just the docs):
 *   - `simple_mode`:  { description, instrumental, vocal_language } — a one-line idea only,
 *     no lyrics/bpm/key/duration.
 *   - `custom_mode`:  { caption, lyrics, bpm, duration, keyscale, language, timesignature } —
 *     a full form fill, with `keyscale`/`timesignature`/`language` (no underscore, different
 *     names) instead of `key_scale`/`time_signature`/`vocal_language`.
 * Both are normalized to `SampleResult` here so callers see one consistent shape.
 */
export async function createRandomSample(sampleType: 'simple_mode' | 'custom_mode'): Promise<SampleResult> {
  const raw = await call<{
    description?: string;
    instrumental?: boolean;
    vocal_language?: string;
    caption?: string;
    lyrics?: string;
    bpm?: number;
    duration?: number;
    keyscale?: string;
    language?: string;
    timesignature?: string;
  }>('/create_random_sample', { sample_type: sampleType });

  if (sampleType === 'simple_mode') {
    return { caption: raw.description ?? '', lyrics: '', vocal_language: raw.vocal_language };
  }
  return {
    caption: raw.caption ?? '',
    lyrics: raw.lyrics ?? '',
    bpm: raw.bpm,
    key_scale: raw.keyscale,
    time_signature: raw.timesignature,
    duration: raw.duration,
    vocal_language: raw.language,
  };
}

/**
 * Calls ACE-Step's `/v1/create_sample` — LM-generated caption/lyrics/metadata from a free-form
 * query. Its response uses `keyscale`/`timesignature` (no underscore), unlike every other
 * endpoint's `key_scale`/`time_signature` — remapped here so callers see one consistent shape.
 */
export async function createSampleFromQuery(params: {
  query: string;
  instrumental?: boolean;
  vocalLanguage?: string;
  temperature?: number;
}): Promise<SampleResult> {
  const raw = await call<{
    caption: string;
    lyrics: string;
    bpm?: number;
    keyscale?: string;
    timesignature?: string;
    duration?: number;
    vocal_language?: string;
  }>('/v1/create_sample', {
    query: params.query,
    instrumental: params.instrumental,
    vocal_language: params.vocalLanguage,
    temperature: params.temperature,
  });
  return {
    caption: raw.caption,
    lyrics: raw.lyrics,
    bpm: raw.bpm,
    key_scale: raw.keyscale,
    time_signature: raw.timesignature,
    duration: raw.duration,
    vocal_language: raw.vocal_language,
  };
}

/**
 * Calls ACE-Step's `/v1/analyze_audio` — "describe this audio for me": LM-generated
 * caption/lyrics plus any metadata it infers (bpm/key/duration/etc), mirroring what
 * `formatInput` does for text-only input. Multipart field name is `audio` (the route
 * also accepts a `src_audio_path` shortcut for files already on the ACE-Step host's
 * filesystem, but that doesn't apply across `ACESTEP_API_URL` — always upload bytes).
 *
 * Unlike generation, this endpoint doesn't reliably lazy-load its own models — a cold
 * ACE-Step process can 503 "not initialized" immediately with no load ever kicked off.
 * When `model` is given (the caller's currently-selected model), explicitly loads it
 * (+ the LM, which analysis always needs for the caption/metadata step) first.
 */
export async function analyzeAudio(
  file: { data: Buffer; filename: string },
  model?: string,
): Promise<FormatInputResult> {
  if (model) await initModel({ model, initLlm: true });
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(file.data)]), file.filename);
  // ACE-Step's analyze_audio_route.py answers with key_scale/time_signature/vocal_language; older
  // builds answered keyscale/timesignature/language like createRandomSample does. Read either, or
  // those fields silently come back undefined even though ACE-Step returned them.
  const raw = await call<{
    caption: string;
    lyrics?: string;
    bpm?: number;
    key_scale?: string;
    keyscale?: string;
    time_signature?: string;
    timesignature?: string;
    duration?: number;
    vocal_language?: string;
    language?: string;
  }>('/v1/analyze_audio', undefined, { method: 'POST', body: form });
  return {
    caption: raw.caption,
    lyrics: raw.lyrics ?? '',
    bpm: raw.bpm,
    key_scale: raw.key_scale ?? raw.keyscale,
    time_signature: raw.time_signature ?? raw.timesignature,
    duration: raw.duration,
    vocal_language: raw.vocal_language ?? raw.language,
  };
}
