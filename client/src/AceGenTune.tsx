import type { ReactNode } from 'react';
import type { ModelInventory } from './api';
import { useSettings } from './settings';
import { useCreateDraftStore } from './createDraftStore';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { Seed } from './Seed';
import { AdvancedGenSettings } from './AdvancedGenSettings';
import { ditModelDescription, lmModelDescription, stepsMax, guidanceEffective, autoSteps, modelFamily } from './modelInfo';
import { qualitySteps } from './qualitySteps';
import { SLOW_ACESTEP_NOTE, type Lookup } from './lookup';

const STEPS_INFO = 'Diffusion steps — more steps means finer detail but slower generation. Turbo models: 1–20 (8 recommended). Base/SFT models: 32–100 recommended. AUTO picks the count the selected model wants (Turbo 8, SFT 50, Base 32). Moving this sets QUALITY to custom.';
const GUIDANCE_INFO = 'Prompt adherence strength (CFG) — higher follows the prompt more strictly, but can overfit or sound artificial. Only affects Base/SFT models; Turbo ignores it. AUTO uses the model\'s own default.';
const AUTO = { label: 'AUTO', value: '' };

/** STEPS readout under AUTO: the count AUTO resolves to once a model is known, bare 'AUTO' when
 * only the server can know (see server/src/services/inferenceSteps.ts). */
function autoStepsLabel(model: string): string {
  const steps = autoSteps(model);
  return steps === null ? 'AUTO' : `AUTO (${steps})`;
}

/** TUNE's body on ACE-Step: what the left settings panel's generate mode held, same gating — LM
 * controls hidden on A SONG I HAVE (`cover` skips the LM), THINKING hidden on ONE TRACK
 * (`complete` skips the in-generation LM). On those two, `modelControl` (the flow's own MODEL
 * pick) replaces DIT MODEL and `flowModel` gates STEPS/GUIDANCE/ADVANCED. STEPS shows the
 * QUALITY preset's count until it is moved, which makes QUALITY custom. */
export function AceGenTune({ inventory, modelControl, flowModel, stepsModel }: {
  inventory: Lookup<ModelInventory> & { retry: () => void };
  modelControl?: ReactNode;
  flowModel?: string;
  stepsModel: string;
}) {
  const { gen, setGen } = useSettings();
  const genType = useCreateDraftStore((s) => s.genType);
  const hideLm = genType === 'audio';
  const gating = flowModel ?? gen.model;
  const models = inventory.data?.models.map((m) => m.name) ?? [];
  const lmModels = inventory.data?.lmModels ?? [];
  const max = stepsMax(gating);
  const preset = gen.quality === 'custom' ? null : gen.quality;
  const presetSteps = preset ? qualitySteps(preset, modelFamily(stepsModel)) : null;

  return (
    <>
      {inventory.error && (
        <div className="error">couldn&apos;t load the model list — {inventory.error} <button onClick={inventory.retry}>RETRY</button></div>
      )}
      {inventory.slow && <div className="meta">loading the model list… {SLOW_ACESTEP_NOTE}</div>}
      {modelControl ?? (
        <CustomSelect label="DIT MODEL" value={gen.model}
          onChange={(v) => setGen({ model: v, inferenceSteps: Math.min(gen.inferenceSteps, stepsMax(v)) })}
          options={[{ ...AUTO, description: ditModelDescription('') }, ...models.map((m) => ({ label: m, value: m, description: ditModelDescription(m) }))]} />
      )}
      {!hideLm && (
        <>
          <CustomSelect label="LM MODEL" value={gen.lmModel} onChange={(v) => setGen({ lmModel: v })}
            options={[{ ...AUTO, description: lmModelDescription('') }, ...lmModels.map((m) => ({ label: m, value: m, description: lmModelDescription(m) }))]} />
          {genType !== 'complete' && (
            <Toggle label="THINKING MODE" checked={gen.thinking} onChange={(v) => setGen({ thinking: v })} ai />
          )}
          <Toggle label="AI ENHANCE" checked={gen.useFormat} onChange={(v) => setGen({ useFormat: v })} ai />
        </>
      )}
      <Slider label="STEPS" min={0} max={max} step={1} info={STEPS_INFO}
        value={preset ? Math.min(presetSteps ?? 0, max) : Math.min(gen.inferenceSteps, max)}
        readout={preset ? `${preset.toUpperCase()} · ${presetSteps ?? autoStepsLabel(stepsModel)}`
          : gen.inferenceSteps === 0 ? autoStepsLabel(gating) : undefined}
        onChange={(v) => setGen({ quality: 'custom', inferenceSteps: v })} />
      <Slider label="GUIDANCE" value={gen.guidanceScale} min={0} max={15} step={0.5}
        readout={!guidanceEffective(gating) ? 'N/A' : gen.guidanceScale === 0 ? 'AUTO' : undefined}
        info={GUIDANCE_INFO} disabled={!guidanceEffective(gating)}
        onChange={(v) => setGen({ guidanceScale: v })} />
      <Seed random={gen.randomSeed} seed={gen.seed}
        onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
      <AdvancedGenSettings adv={gen} setAdv={setGen} gatingModel={gating} hideLmControls={hideLm} />
    </>
  );
}
