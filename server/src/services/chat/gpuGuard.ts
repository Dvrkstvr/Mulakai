/**
 * The GPU check before a chat job that needs the card (READ, CREATE SONG, CREATE COVER; D-053,
 * docs/decisions/0008): refused while a planner model is loaded, unless a `plan` job holds the slot
 * (it unloads before the next job starts, D-011). One implementation; CREATE SONG's inline copy in
 * createFromDraft moves here with CR-4.
 */
import { config } from '../../config.js';
import { getRunning } from '../genQueue.js';
import { loadedModels, type LoadedModel } from '../score/ollamaControl.js';
import { plannerLoaded } from '../score/scoreLimits.js';

export interface GpuGuardDeps {
  plannerConfigured: boolean;
  /** A `plan` job holds the slot. */
  planRunning: () => boolean;
  /** The planner's `/api/ps`. */
  loaded: () => Promise<LoadedModel[]>;
}

export function gpuGuardDeps(over: Partial<GpuGuardDeps> = {}): GpuGuardDeps {
  return {
    plannerConfigured: Boolean(config.llmUrl),
    planRunning: () => getRunning()?.kind === 'plan',
    loaded: () => loadedModels({ url: config.llmUrl, model: config.llmModel }),
    ...over,
  };
}

/** Null when the job may start; else the refusal (the planner model names). An unreachable
 * planner holds nothing on the GPU, so it reads as empty. */
export async function gpuGuard(deps: GpuGuardDeps = gpuGuardDeps()): Promise<string | null> {
  if (!deps.plannerConfigured || deps.planRunning()) return null;
  const models = await deps.loaded().catch(() => [] as LoadedModel[]);
  return models.length ? plannerLoaded(models.map((m) => m.name)) : null;
}
