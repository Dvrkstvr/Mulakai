import type { TuneSettings } from './settingsTypes';
import { Slider } from './Slider';
import { Seed } from './Seed';
import { AdvancedGenSettings } from './AdvancedGenSettings';
import { stepsMax, guidanceEffective } from './modelInfo';
import { STEPS_INFO, GUIDANCE_INFO, autoStepsLabel } from './knobInfo';

/** STEPS, GUIDANCE, SEED and ADVANCED for one action's own TUNE (REPAINT's or ADD LAYER's, PR 11), gated on the model
 * that action runs on. */
export function RepaintKnobs({ gatingModel, knobs: repaint, set: setRepaint }: {
  gatingModel: string; knobs: TuneSettings; set: (patch: Partial<TuneSettings>) => void;
}) {
  return (
    <>
      <Slider label="STEPS" value={repaint.inferenceSteps} min={0} max={stepsMax(gatingModel)} step={1}
        readout={repaint.inferenceSteps === 0 ? autoStepsLabel(gatingModel) : undefined} info={STEPS_INFO}
        onChange={(v) => setRepaint({ inferenceSteps: v })} />
      <Slider label="GUIDANCE" value={repaint.guidanceScale} min={0} max={15} step={0.5}
        readout={!guidanceEffective(gatingModel) ? 'N/A' : repaint.guidanceScale === 0 ? 'AUTO' : undefined}
        info={GUIDANCE_INFO} disabled={!guidanceEffective(gatingModel)}
        onChange={(v) => setRepaint({ guidanceScale: v })} />
      <Seed random={repaint.randomSeed} seed={repaint.seed}
        onRandom={(v) => setRepaint({ randomSeed: v })} onSeed={(v) => setRepaint({ seed: v })} />
      <AdvancedGenSettings adv={repaint} setAdv={setRepaint} gatingModel={gatingModel} hideLmControls />
    </>
  );
}
