/**
 * Resolves Mulakai's STEPS AUTO into a real `inference_steps` value.
 *
 * AUTO means "omit the field" client-side (settings.ts's `inferenceSteps > 0`
 * guards). ACE-Step's API then falls back to a flat 8 regardless of which DiT is
 * loaded — right for Turbo, which is distilled for it, badly wrong for Base/SFT,
 * which want 32-50 and produce undercooked, noisy audio at 8. Upstream PR #1223
 * fixes this API-side but is unmerged on a frozen `main`, so we resolve here
 * instead: it's the parameter we send, and unlike the API we can consult the
 * model inventory to classify the AUTO-model case too.
 *
 * See PLAN.md "STEPS AUTO Resolves Per Model (planned 2026-07-31)".
 */
import { listModels, type ReleaseTaskParams } from './acestep.js';

export type ModelFamily = 'turbo' | 'sft' | 'other';

/** Steps per family, matching PR #1223's table so we don't diverge from upstream
 * if it ever lands. `other` (i.e. Base) takes the floor of its 32-100 band —
 * the safe default for an unattended AUTO. Mirrored for display only in
 * client/src/modelInfo.ts; this copy is authoritative. */
const AUTO_STEPS: Record<ModelFamily, number> = { turbo: 8, sft: 50, other: 32 };

/** ACE-Step's own hardcoded default (release_task_models.py, release_task_request_builder.py).
 * Only used when the model can't be identified at all, so an unreachable inventory
 * changes nothing rather than picking a wrong number. */
const LEGACY_STEPS = 8;

/** Whether `token` appears in `name` as a delimiter-bounded segment rather than a bare
 * substring — see the matching helper in client/src/modelInfo.ts for why. */
function hasToken(name: string, token: string): boolean {
  return new RegExp(`(^|[\\\\/._-])${token}($|[\\\\/._-])`).test(name);
}

/** Classify a DiT model name, or null for an empty/absent name. Turbo is tested
 * before SFT, so a hypothetical `turbo-sft` reads as distilled. */
export function modelFamily(name: string | undefined | null): ModelFamily | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (hasToken(n, 'turbo')) return 'turbo';
  if (hasToken(n, 'sft')) return 'sft';
  return 'other';
}

/** Steps `name` wants, or null when it can't be classified. */
export function stepsForModel(name: string | undefined | null): number | null {
  const family = modelFamily(name);
  return family === null ? null : AUTO_STEPS[family];
}

/**
 * Fill `params.inference_steps` in place when the caller left it unset.
 *
 * Mutates rather than returning a copy so it can sit next to `ensureModelLoaded`
 * at every submission site and have the resolved value flow into whatever the
 * caller later persists to `versions.params_json` — recording AUTO while the run
 * actually used 50 would make version history lie.
 *
 * An explicit count always wins (this is what keeps remasterJobs.ts's own steps
 * intact). A non-positive count is treated as unset, since 0 steps is not a
 * meaningful request.
 */
export async function resolveInferenceSteps(params: ReleaseTaskParams): Promise<void> {
  if ((params.inference_steps ?? 0) > 0) return;
  const direct = stepsForModel(params.model);
  if (direct !== null) {
    params.inference_steps = direct;
    return;
  }
  // AUTO model: ACE-Step will lazy-load its own default, so ask which one that is.
  // listModels() already swallows transport errors into an empty inventory.
  const { defaultModel } = await listModels();
  params.inference_steps = stepsForModel(defaultModel) ?? LEGACY_STEPS;
}
