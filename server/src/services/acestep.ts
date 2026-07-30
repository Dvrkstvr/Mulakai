/** Typed client for the ACE-Step 1.5 native FastAPI server (docs/en/API.md). */
import { config } from '../config.js';
import type { OutputSettings } from './audioOutput.js';

export type TaskType = 'text2music' | 'repaint' | 'cover' | 'lego' | 'extract' | 'complete';

export interface ReleaseTaskParams {
  /** The user's output format/rate/depth. Never sent to ACE-Step (stripped in
   * releaseTask) — it travels here so every job path already carrying params
   * can reach transcode.ts without a parallel plumbing channel. */
  output?: OutputSettings;
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
  /** lego/extract/complete only — templates ACE-Step's own instruction string server-side
   * (acestep/constants.py's TRACK_NAMES); independent of the free-text prompt field. */
  track_name?: string;
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
  // Like createRandomSample/createSampleFromQuery, the raw response uses keyscale/timesignature/
  // language (no underscore, different names) instead of key_scale/time_signature/vocal_language —
  // remapped here so callers see FormatInputResult's shape. Without this, key_scale/time_signature
  // silently come back undefined even though ACE-Step returned them.
  const raw = await call<{
    caption: string;
    lyrics?: string;
    bpm?: number;
    keyscale?: string;
    timesignature?: string;
    duration?: number;
    language?: string;
  }>('/v1/analyze_audio', undefined, { method: 'POST', body: form });
  return {
    caption: raw.caption,
    lyrics: raw.lyrics ?? '',
    bpm: raw.bpm,
    key_scale: raw.keyscale,
    time_signature: raw.timesignature,
    duration: raw.duration,
    vocal_language: raw.language,
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
  /** 0.0-1.0, fed from ACE-Step's diffusion-loop callback; only meaningful while status is still running. */
  progress?: number;
  /** Free-text label from ACE-Step (e.g. "running"); raw wire field, not Mulakai's own Job.status lifecycle. */
  stage?: string;
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
  if (!res.ok) {
    // Most ACE-Step failures come back as HTTP 200 with a {data,code,error} envelope (handled
    // below), but some routes (e.g. analyze_audio's "DiT/LLM not initialized") raise a real
    // FastAPI HTTPException — a genuine non-2xx status with a bare {"detail": "..."} body, no
    // envelope at all. Surface that detail instead of a bare "HTTP 503".
    const errBody = await res.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error(`ACE-Step ${endpoint} -> ${errBody?.error ?? errBody?.detail ?? `HTTP ${res.status}`}`);
  }
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
  // `output` is ours, not ACE-Step's — it rides on the params object so the
  // existing route allowlists and job plumbing carry it, and is stripped here,
  // at the single point where params actually go over the wire.
  const { output: _output, ...wire } = params;
  if (!files?.srcAudio && !files?.referenceAudio) return call('/release_task', wire);
  const form = new FormData();
  for (const [k, v] of Object.entries(wire)) {
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
  modelGeneration++;
}

let modelGeneration = 0;

/**
 * Counts how many times slot 1's model has been rebuilt. Anything attached to the model
 * rather than to the request — today only LoRA adapters (see adapters.ts) — must re-apply
 * itself when this changes.
 *
 * `/v1/init` rebuilds unconditionally ("it does not short-circuit when components are
 * already loaded", ACE-Step's init_service_orchestrator.py) and does *not* clear the
 * handler's `lora_loaded`/`use_lora` flags, so after an init `/v1/lora/status` still
 * reports an adapter that is no longer attached to the new decoder. Its `loaded` field
 * therefore cannot be used to decide whether a re-load is needed; this counter can.
 */
export function getModelGeneration(): number {
  return modelGeneration;
}

export interface LoraStatus {
  loaded: boolean;
  /** ACE-Step's `use_lora` — an adapter can be loaded but toggled off. */
  active: boolean;
  scale: number;
  /** 'lora' (PEFT directory) | 'lokr' (LyCORIS safetensors), or null when nothing is loaded. */
  adapterType: string | null;
}

/**
 * Adapter lifecycle. These routes are absent from docs/ace-step-1.5/API.md (which documents
 * only the training API) — they live in ACE-Step's acestep/api/http/lora_routes.py.
 *
 * Two things worth knowing about them: a successful load also *activates* the adapter
 * (lora/lifecycle.py sets `lora_loaded` and `use_lora` together), so no toggle call is
 * needed to start using one; and `/load`+`/unload` raise real FastAPI HTTPExceptions while
 * `/toggle`+`/scale` return a `code=400` envelope instead — `call()` already surfaces the
 * message from either shape.
 */
export async function loadLora(loraPath: string): Promise<void> {
  await call('/v1/lora/load', { lora_path: loraPath });
}

export async function unloadLora(): Promise<void> {
  await call('/v1/lora/unload', {});
}

export async function toggleLora(useLora: boolean): Promise<void> {
  await call('/v1/lora/toggle', { use_lora: useLora });
}

/** `scale` is clamped to 0.0-1.0 by ACE-Step's own pydantic model. */
export async function setLoraScale(scale: number): Promise<void> {
  await call('/v1/lora/scale', { scale });
}

export async function loraStatus(): Promise<LoraStatus> {
  const raw = await call<{ lora_loaded: boolean; use_lora: boolean; lora_scale: number; adapter_type: string | null }>(
    '/v1/lora/status',
  );
  return { loaded: raw.lora_loaded, active: raw.use_lora, scale: raw.lora_scale, adapterType: raw.adapter_type };
}

export async function queryResult(
  taskIds: string[],
): Promise<Array<{ task_id: string; status: 0 | 1 | 2; result: TaskResult[]; progress_text?: string }>> {
  const rows = await call<Array<{ task_id: string; status: 0 | 1 | 2; result: string; progress_text?: string }>>(
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
