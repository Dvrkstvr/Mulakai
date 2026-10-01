/** Model slot loading, checkpoint inventory, and the health probe. */
import { config } from '../../config.js';
import { call } from './http.js';
import type { TaskType } from './types.js';

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
    const res = await fetch(`${config.acestepUrl}/v1/model_inventory`, { headers, signal: AbortSignal.timeout(config.acestepTimeoutMs) });
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
    // Short leash: this backs the UI status pill, where a hung probe is as bad as a down one.
    const res = await fetch(`${config.acestepUrl}/health`, { signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}
