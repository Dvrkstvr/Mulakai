import { modelFamily, type ModelFamily } from './modelInfo';

/** Create's QUALITY chips (PLAN.md "S2 — Guided Create", point 4). `custom` = the STEPS slider
 * in TUNE was moved by hand, so no chip is lit and its value is sent as-is. */
export type Quality = 'draft' | 'balanced' | 'best' | 'custom';
export type QualityPreset = Exclude<Quality, 'custom'>;

export const QUALITY_PRESETS: QualityPreset[] = ['draft', 'balanced', 'best'];

/** BALANCED is null: it sends no `inference_steps`, so the server's resolveInferenceSteps stays
 * the single AUTO authority (the numbers in PLAN.md's table are what AUTO resolves to). */
const STEPS: Record<Exclude<ModelFamily, 'unknown'>, Record<QualityPreset, number | null>> = {
  turbo: { draft: 4, balanced: null, best: 12 },
  sft: { draft: 24, balanced: null, best: 80 },
  other: { draft: 16, balanced: null, best: 64 },
};

/** Steps a preset sends for a model family; null = AUTO. An unknown family (AUTO model with no
 * inventory default yet) sends AUTO for every preset rather than guess a count. */
export function qualitySteps(quality: QualityPreset, family: ModelFamily): number | null {
  return family === 'unknown' ? null : STEPS[family][quality];
}

const FEEL: Record<QualityPreset, string> = {
  draft: 'fastest, rougher',
  balanced: "the model's own step count",
  best: 'slower, finer detail',
};

/** QUALITY's hint line. With the model family unknown, DRAFT/BEST can only send AUTO, so the
 * line says so and why (`unknownWhy`) rather than promising a speed it won't deliver. */
export function qualityHint(quality: Quality, family: ModelFamily, unknownWhy: string): string {
  if (quality === 'custom') return 'custom steps, set in TUNE · pick one to go back to a preset';
  const steps = qualitySteps(quality, family);
  if (steps !== null) return `${steps} steps · ${FEEL[quality]}`;
  if (quality === 'balanced') return `AUTO steps · ${FEEL.balanced}`;
  return `${quality.toUpperCase()} applies once the model is known — ${unknownWhy} · AUTO steps until then`;
}

/** The `inference_steps` a request carries for `model` (the model actually run, AUTO already
 * resolved to the inventory default by the caller); 0 = AUTO, omit the field. */
export function resolveSteps(g: { quality: Quality; inferenceSteps: number }, model: string): number {
  if (g.quality === 'custom') return g.inferenceSteps;
  return qualitySteps(g.quality, modelFamily(model)) ?? 0;
}

/** A settings blob saved before QUALITY existed: hand-set steps stay exactly as they were. */
export function migrateQuality(saved: { quality?: Quality; inferenceSteps?: number } | undefined): Quality {
  if (saved?.quality) return saved.quality;
  return (saved?.inferenceSteps ?? 0) > 0 ? 'custom' : 'balanced';
}
