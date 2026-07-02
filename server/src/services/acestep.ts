/** Typed client for the ACE-Step 1.5 native FastAPI server (docs/en/API.md). */
import { config } from '../config.js';

export type TaskType = 'text2music' | 'repaint' | 'cover' | 'lego' | 'extract' | 'complete';

export interface ReleaseTaskParams {
  prompt?: string;
  lyrics?: string;
  thinking?: boolean;
  sample_query?: string;
  use_format?: boolean;
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
  repaint_mode?: 'conservative' | 'balanced' | 'aggressive';
  repaint_strength?: number;
  audio_format?: string;
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

/** Submit a generation job. For repaint/lego, pass srcAudio to upload the source file. */
export async function releaseTask(
  params: ReleaseTaskParams,
  srcAudio?: { data: Buffer; filename: string },
): Promise<{ task_id: string }> {
  if (!srcAudio) return call('/release_task', params);
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  form.append('src_audio', new Blob([new Uint8Array(srcAudio.data)]), srcAudio.filename);
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
