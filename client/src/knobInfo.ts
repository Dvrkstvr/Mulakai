import { autoSteps } from './modelInfo';

export const STEPS_INFO = 'Diffusion steps — more steps means finer detail but slower generation. Turbo models: 1–20 (8 recommended). Base/SFT models: 32–100 recommended. AUTO picks the count the selected model wants (Turbo 8, SFT 50, Base 32).';

export const GUIDANCE_INFO = 'Prompt adherence strength (CFG) — higher follows the prompt more strictly, but can overfit or sound artificial. Only affects Base/SFT models; Turbo ignores it. AUTO uses the model\'s own default.';

/** STEPS readout under AUTO. Shows the number AUTO will actually resolve to once a model is
 * picked; stays bare 'AUTO' for AUTO model, where only the server can know which checkpoint
 * ACE-Step will load (see server/src/services/inferenceSteps.ts). */
export function autoStepsLabel(model: string): string {
  const steps = autoSteps(model);
  return steps === null ? 'AUTO' : `AUTO (${steps})`;
}
