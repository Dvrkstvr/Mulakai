/** LoRA/LoKr adapter lifecycle on the loaded model. */
import { call } from './http.js';

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
