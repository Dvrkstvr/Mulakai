import { guidanceEffective, modelFamily } from './modelInfo';

export interface TuneKnobs {
  inferenceSteps: number;
  guidanceScale: number;
  randomSeed: boolean;
  seed: number;
}

function modelWord(model: string): string {
  const family = modelFamily(model);
  if (family === 'unknown') return 'auto model';
  if (family !== 'other') return family;
  return model.toLowerCase().includes('base') ? 'base' : model;
}

/** TUNE's collapsed line: "turbo · steps auto · guidance n/a · seed random". */
export function tuneSummary(model: string, k: TuneKnobs): string {
  const steps = k.inferenceSteps > 0 ? `steps ${k.inferenceSteps}` : 'steps auto';
  const guidance = !guidanceEffective(model) ? 'guidance n/a' : k.guidanceScale > 0 ? `guidance ${k.guidanceScale}` : 'guidance auto';
  const seed = k.randomSeed ? 'seed random' : `seed ${k.seed}`;
  return [modelWord(model), steps, guidance, seed].join(' · ');
}
