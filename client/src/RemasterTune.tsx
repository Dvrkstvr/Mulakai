import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { TuneDisclosure } from './TuneDisclosure';
import { ditModelDescription } from './modelInfo';
import { recommendedSteps, remasterStepsHint } from './remasterChoice';

const STEPS_INFO =
  'Diffusion steps for this pass. 0 = RECOMMENDED: the model\'s own count (50 for SFT, 32 for Base). ' +
  'Time grows with the count; past the recommended one the gain is small. Shared with Settings › Playback & Export.';

/** REMASTERED MIX's TUNE (PLAN.md "Remaster TUNE"): the cover-capable DIT MODEL and STEPS, both remembered. */
export function RemasterTune({ coverModels, model }: { coverModels: string[]; model: string }) {
  const steps = useSettings((s) => s.exportSettings.steps);
  const setExportSettings = useSettings((s) => s.setExportSettings);
  const summary = `${model} · ${steps > 0 ? `steps ${steps}` : `steps ${recommendedSteps(model)} (recommended)`}`;
  return (
    <TuneDisclosure summary={summary}>
      <CustomSelect
        label="DIT MODEL"
        value={model}
        onChange={(v) => setExportSettings({ remasterModel: v })}
        options={coverModels.map((m) => ({ label: m, value: m, description: ditModelDescription(m) }))}
      />
      <Slider label="STEPS" value={steps} min={0} max={200} step={1}
        readout={steps === 0 ? `RECOMMENDED · ${recommendedSteps(model)}` : undefined} info={STEPS_INFO}
        onChange={(v) => setExportSettings({ steps: v })} />
      <div className="hint">
        {remasterStepsHint(steps, model)}
        {steps > 0 && <> · <button type="button" onClick={() => setExportSettings({ steps: 0 })}>USE RECOMMENDED</button></>}
      </div>
    </TuneDisclosure>
  );
}
