import { autoSteps } from './modelInfo';

/** STEPS for REMASTERED MIX when the model's family is unknown — ACE-Step's own SFT count. */
const FALLBACK_STEPS = 50;

/** The count ACE-Step recommends for `model` (GUIDE.md): what STEPS 0 = RECOMMENDED sends. */
export function recommendedSteps(model: string): number {
  return autoSteps(model) ?? FALLBACK_STEPS;
}

/** The `inference_steps` a remaster sends: always explicit, so the server's own default never applies. */
export function remasterSteps(steps: number, model: string): number {
  return steps > 0 ? steps : recommendedSteps(model);
}

/** STEPS' hint line: what is recommended, or how a hand-set count compares with it. */
export function remasterStepsHint(steps: number, model: string): string {
  const rec = recommendedSteps(model);
  if (steps <= 0 || steps === rec) return `${rec} recommended for ${model}`;
  const ratio = Math.round((steps / rec) * 10) / 10;
  return `${steps} steps ≈ ${ratio}× the time of the recommended ${rec}`;
}

/** The remembered model if it is still downloaded, else xl-sft, else the first cover-capable model. */
export function pickRemasterModel(names: string[], saved: string): string {
  if (saved && names.includes(saved)) return saved;
  return names.find((n) => n.includes('xl-sft')) ?? names[0] ?? '';
}

/** REMASTER MIX's consequence line. XL weights outgrow a 16 GB card, so an XL run says it is slow. */
export function remasterConsequence(model: string, steps: number): string {
  const xl = /(^|[\\/._-])xl($|[\\/._-])/i.test(model);
  const what = `runs one ACE-Step pass over the whole mix with ${model} at ${steps} steps`;
  return xl ? `${what} — several minutes on an XL model — and isn't kept` : `${what}, and isn't kept`;
}
