/** ACE-Step model/adapter preparation run before every job's release_task. */
import { initModel, type ReleaseTaskParams } from './acestep.js';
import { reconcileAdapter } from './adapters.js';

/**
 * Load the requested model into slot 1 if a specific one was chosen.
 * AUTO (no model / no LM selected) skips init and lets ACE-Step lazy-load its
 * own defaults. The 5Hz LM is silently skipped by ACE-Step for repaint/cover/
 * extract task types (docs/ace-step-1.5/API.md#4.2), so an LM selection is
 * ignored here for those task types rather than wastefully loaded. lego/complete
 * skip the same in-generation LM stage (upstream #1287), but the API still runs
 * use_format's format_sample() for them before generation — only thinking is dead.
 */
export async function ensureModelLoaded(params: ReleaseTaskParams): Promise<void> {
  const lmIgnored = params.task_type === 'repaint' || params.task_type === 'cover' || params.task_type === 'extract';
  const thinkingIgnored = lmIgnored || params.task_type === 'lego' || params.task_type === 'complete';
  const lmSelected = !lmIgnored && !!params.lm_model_path;
  const needLlm = !lmIgnored && ((!thinkingIgnored && !!params.thinking) || !!params.use_format || lmSelected);
  if (params.model || lmSelected) {
    await initModel({ model: params.model, lmModel: lmSelected ? params.lm_model_path : undefined, initLlm: needLlm });
  }
  // Strictly after init: adapters attach to the model, so an init above has just dropped
  // whichever one was loaded (see adapters.ts). ACE-Step has no per-request adapter param,
  // so this is the only place the selection can be honoured — and, since `params` is the
  // object every persist path records into versions.params_json, stamped.
  const adapter = await reconcileAdapter();
  if (adapter) params.adapter = adapter;
}
