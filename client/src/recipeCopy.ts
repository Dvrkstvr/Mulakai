import type { GenType } from './createDraft';
import { etaKey, formatEta } from './etaStore';
import { modelFamily } from './modelInfo';
import type { Quality } from './qualitySteps';

/** The ACE-Step task each START FROM card runs. */
export const GEN_TASK = { prompt: 'text2music', audio: 'cover', complete: 'complete' } as const;

/** The ETA bucket a take falls in: ACE-Step's waits differ by model family and QUALITY, an
 * extra engine's by neither. */
export function recipeEtaKey(genType: GenType, engine: string, stepsModel: string, quality: Quality): string {
  const ace = engine === 'acestep';
  return etaKey({
    task: GEN_TASK[genType], engine, family: ace ? modelFamily(stepsModel) : 'na', quality: ace ? quality : 'na',
  });
}

/** The line under the RECIPE card's ENGINE row: what that engine does with this START FROM.
 * `engine` is the extra engine's label, or null for ACE-Step. */
export function engineNote(genType: GenType, engine: string | null): string {
  if (genType === 'complete') return 'arranging always runs on ACE-Step';
  if (genType === 'audio') {
    return engine ? `${engine} sings the source's melody from a score · later edits use ACE-Step`
      : 'ACE-Step restyles the whole recording';
  }
  return engine ? `${engine} makes the first take · every later edit uses ACE-Step`
    : 'full control · reference voice · editable afterwards';
}

/** "Takes about": a measured mean, or, for an engine cover still missing its score, the
 * multi-step flow ahead (TRANSCRIBE, maybe READ LYRICS, then the cover). Null hides the row. */
export function etaLabel(mean: number | null, coverStepsAhead = 1): string | null {
  if (coverStepsAhead > 1) return `a few min · ${coverStepsAhead} steps`;
  return mean === null ? null : formatEta(mean);
}

/** TUNE's collapsed line: what was changed from default, or `<names> · all default`. */
export function tuneSummary(changed: string[], names: string): string {
  return changed.length ? changed.join(' · ') : `${names} · all default`;
}

/** An extra engine's TUNE changes: its controls off AUTO (0 or ''), and a fixed seed. */
export function engineTuneChanges(
  controls: readonly string[], values: Record<string, string | number>, seed: { live: boolean; random: boolean; value: number },
): string[] {
  return [
    ...controls.filter((c) => values[c]).map((c) => `${c.toLowerCase()} ${values[c]}`),
    seed.live && !seed.random ? `seed ${seed.value}` : '',
  ].filter(Boolean);
}

/** The ACE-Step settings TUNE names when they differ from default. `model` is compared with
 * the flow's own default (AUTO on AN IDEA, the auto-picked model on COVER/ARRANGE). */
export function aceTuneChanges(s: {
  model: string; defaultModel: string; customSteps: number | null; guidance: number; guidanceLive: boolean;
  randomSeed: boolean; seed: number;
}): string[] {
  return [
    s.model && s.model !== s.defaultModel ? s.model.toLowerCase() : '',
    s.customSteps !== null ? `${s.customSteps || 'auto'} steps` : '',
    s.guidanceLive && s.guidance > 0 ? `guidance ${s.guidance}` : '',
    s.randomSeed ? '' : `seed ${s.seed}`,
  ].filter(Boolean);
}
