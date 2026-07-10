/** Typed client for the ACE-Step 1.5 native FastAPI server (docs/en/API.md). */
import { config } from '../config.js';

export type TaskType = 'text2music' | 'repaint' | 'cover' | 'lego' | 'extract' | 'complete';

export interface ReleaseTaskParams {
  prompt?: string;
  lyrics?: string;
  thinking?: boolean;
  sample_query?: string;
  use_format?: boolean;
  use_cot_caption?: boolean;
  use_cot_language?: boolean;
  model?: string;
  lm_model_path?: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  vocal_language?: string;
  audio_duration?: number;
  inference_steps?: number;
  guidance_scale?: number;
  use_random_seed?: boolean;
  seed?: number;
  batch_size?: number;
  task_type?: TaskType;
  instruction?: string;
  repainting_start?: number;
  repainting_end?: number;
  audio_cover_strength?: number;
  /** Waveform-level splice crossfade at the repaint region boundary, in seconds. 0 = hard cut (default). */
  repaint_wav_crossfade_sec?: number;
  audio_format?: string;
  /** Anchor seed for variance-preserving noise mixing; only consumed when retake_variance > 0. */
  retake_seed?: string;
  /** 0 = no-op (default); 0.05-0.15 subtle variation; 0.5+ strong departure. */
  retake_variance?: number;
  /** Timestep shift factor, 1.0-5.0. Only effective for base models, not turbo. */
  shift?: number;
  infer_method?: 'ode' | 'sde';
  /** Comma-separated custom timesteps; overrides inference_steps and shift when set. */
  timesteps?: string;
  /** Adaptive Dual Guidance — base model only. */
  use_adg?: boolean;
  cfg_interval_start?: number;
  cfg_interval_end?: number;
  lm_temperature?: number;
  lm_cfg_scale?: number;
  lm_negative_prompt?: string;
  /** 0/undefined disables. */
  lm_top_k?: number;
  /** >=1 is treated as disabled. */
  lm_top_p?: number;
  lm_repetition_penalty?: number;
}

/** File extension for a stored/downloaded audio_format value — 'wav32' is still a .wav container. */
export function audioFileExt(audioFormat: string | undefined): string {
  const format = audioFormat ?? 'wav';
  return format === 'wav32' ? 'wav' : format;
}

export interface FormatInputParams {
  prompt?: string;
  lyrics?: string;
  temperature?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  vocal_language?: string;
  audio_duration?: number;
}

export interface FormatInputResult {
  caption: string;
  lyrics: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  duration?: number;
  vocal_language?: string;
}

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

export interface SampleResult {
  caption: string;
  lyrics: string;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  duration?: number;
  vocal_language?: string;
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

export interface TaskResult {
  file: string; // /v1/audio?path=... url
  status: 0 | 1 | 2;
  prompt: string;
  lyrics: string;
  metas: { bpm?: number; duration?: number; keyscale?: string; timesignature?: string };
  seed_value: string;
  dit_model?: string;
}

/** One aligned lyric line: seconds-scaled start/end plus its (possibly bracket-tagged) text. */
export interface SentenceTimestamp {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface LyricTimestampResult {
  lrc_text: string;
  sentence_timestamps: SentenceTimestamp[];
  success: boolean;
  error: string | null;
}

interface Envelope<T> {
  data: T;
  code: number;
  error: string | null;
}

async function call<T>(endpoint: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (config.acestepApiKey) headers['Authorization'] = `Bearer ${config.acestepApiKey}`;
  let opts: RequestInit;
  if (init) {
    opts = { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } };
  } else {
    opts = body
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { headers };
  }
  const res = await fetch(`${config.acestepUrl}${endpoint}`, opts);
  if (!res.ok) throw new Error(`ACE-Step ${endpoint} -> HTTP ${res.status}`);
  const json = (await res.json()) as Envelope<T>;
  if (json.code !== 200) throw new Error(`ACE-Step ${endpoint} -> ${json.error ?? `code ${json.code}`}`);
  return json.data;
}

/**
 * Submit a generation job. `srcAudio` uploads the source file for
 * repaint/cover/lego; `referenceAudio` uploads a saved voice clip for
 * reference-audio style-transfer conditioning (distinct ACE-Step fields,
 * both may be present at once).
 */
export async function releaseTask(
  params: ReleaseTaskParams,
  files?: { srcAudio?: { data: Buffer; filename: string }; referenceAudio?: { data: Buffer; filename: string } },
): Promise<{ task_id: string }> {
  if (!files?.srcAudio && !files?.referenceAudio) return call('/release_task', params);
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  if (files.srcAudio) form.append('src_audio', new Blob([new Uint8Array(files.srcAudio.data)]), files.srcAudio.filename);
  if (files.referenceAudio) {
    form.append('reference_audio', new Blob([new Uint8Array(files.referenceAudio.data)]), files.referenceAudio.filename);
  }
  return call('/release_task', undefined, { method: 'POST', body: form });
}

/**
 * Load/switch the DiT and/or LM model in slot 1 before generating.
 *
 * `release_task`'s `model` param only routes among already-loaded slots and
 * silently falls back to the primary otherwise — so a selected model must be
 * initialized here first. Slow (loads into VRAM); call off the request path.
 */
export async function initModel(opts: { model?: string; lmModel?: string; initLlm?: boolean }): Promise<void> {
  const body: Record<string, unknown> = { slot: 1, init_llm: !!opts.initLlm };
  if (opts.model) body.model = opts.model;
  if (opts.lmModel) body.lm_model_path = opts.lmModel;
  await call('/v1/init', body);
}

export async function queryResult(taskIds: string[]): Promise<Array<{ task_id: string; status: 0 | 1 | 2; result: TaskResult[] }>> {
  const rows = await call<Array<{ task_id: string; status: 0 | 1 | 2; result: string }>>(
    '/query_result',
    { task_id_list: taskIds },
  );
  return rows.map((r) => ({
    ...r,
    result: r.result ? (JSON.parse(r.result) as TaskResult[]) : [],
  }));
}

/**
 * Recover the raw filesystem path ACE-Step embedded in a `/v1/audio?path=...`
 * result URL. `/lyric_timestamp` (and the artifact sidecar it reads) key off
 * that raw path, not the download URL — `query_result` only ever exposes the
 * URL form, so we decode it back here. Returns null if the shape is unexpected.
 */
export function rawPathFromAudioUrl(fileUrl: string): string | null {
  const marker = 'path=';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const encoded = fileUrl.slice(idx + marker.length).split('&')[0];
  const decoded = decodeURIComponent(encoded);
  return decoded || null;
}

/**
 * Request section/line timestamps for a previously generated sample. Depends on
 * the artifact sidecar ACE-Step writes next to the audio at generation time;
 * throws `HTTP 404` when that sidecar is absent (instrumental, save-memory mode,
 * or expired), which callers treat as "no timestamps" rather than a failure.
 */
export async function lyricTimestamp(params: {
  audioPath: string;
  duration: number;
  vocalLanguage?: string;
  inferenceSteps?: number;
  model?: string;
}): Promise<LyricTimestampResult> {
  return call('/lyric_timestamp', {
    audio_path: params.audioPath,
    duration: params.duration,
    vocal_language: params.vocalLanguage ?? 'en',
    inference_steps: params.inferenceSteps ?? 8,
    ...(params.model ? { model: params.model } : {}),
  });
}

/** Download a generated audio file (result.file is a /v1/audio?path=... url). */
export async function downloadAudio(fileUrl: string): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (config.acestepApiKey) headers['Authorization'] = `Bearer ${config.acestepApiKey}`;
  const res = await fetch(`${config.acestepUrl}${fileUrl}`, { headers });
  if (!res.ok) throw new Error(`ACE-Step audio download -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export interface ModelInfo {
  name: string;
  supportedTaskTypes: TaskType[];
}

export interface ModelInventory {
  models: ModelInfo[]; // DiT models
  lmModels: string[]; // 5Hz LM models
  defaultModel: string | null;
}

/**
 * List all downloaded models from ACE-Step's checkpoint inventory.
 *
 * Uses `/v1/model_inventory`, not `/v1/models`: the OpenRouter adapter shadows
 * `/v1/models` with an OpenAI-style (and empty) response, so the native
 * checkpoint scan is only reachable via the inventory endpoint. No fallbacks —
 * an unreachable server yields an empty inventory.
 */
export async function listModels(): Promise<ModelInventory> {
  const empty: ModelInventory = { models: [], lmModels: [], defaultModel: null };
  try {
    const headers: Record<string, string> = {};
    if (config.acestepApiKey) headers['Authorization'] = `Bearer ${config.acestepApiKey}`;
    const res = await fetch(`${config.acestepUrl}/v1/model_inventory`, { headers });
    if (!res.ok) return empty;
    const json = (await res.json()) as {
      data?: {
        models?: Array<{ name: string; supported_task_types?: string[] }>;
        lm_models?: Array<{ name: string }>;
        default_model?: string | null;
      };
    };
    const data = json.data;
    if (!data) return empty;
    return {
      models: (data.models ?? [])
        .filter((m) => m.name)
        .map((m) => ({ name: m.name, supportedTaskTypes: (m.supported_task_types ?? []) as TaskType[] })),
      lmModels: (data.lm_models ?? []).map((m) => m.name).filter(Boolean),
      defaultModel: data.default_model ?? null,
    };
  } catch {
    return empty;
  }
}

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${config.acestepUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
