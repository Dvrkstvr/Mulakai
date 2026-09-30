import type { EngineInfo } from './api';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { Seed } from './Seed';
import { useSettings } from './settings';
import { useCreateDraftStore } from './createDraftStore';
import { aceOnlyNote } from './engineCaps';
import { AUTO_CONTROLS, controlRange, useEngineSettings, type Cot, type SliderControl } from './engineSettings';

const SLIDERS: Record<SliderControl, { label: string; info: string }> = {
  cfg: {
    label: 'CFG',
    info: 'Classifier-free guidance on this engine\'s own scale — not ACE-Step\'s GUIDANCE. Higher follows the prompt more strictly. AUTO uses the engine\'s default.',
  },
  temperature: { label: 'TEMPERATURE', info: 'Sampling randomness — higher is more varied, lower is safer. AUTO uses the engine\'s default.' },
  topK: { label: 'TOP-K', info: 'Samples only from the K likeliest next tokens. AUTO uses the engine\'s default.' },
};

const COT_OPTIONS: { label: string; value: Cot; description: string }[] = [
  { label: 'AUTO', value: '', description: 'The engine\'s default (FULL).' },
  { label: 'FULL', value: 'full', description: 'Plans a chord-annotated score first, then renders it.' },
  { label: 'MELODY', value: 'melody', description: 'Plans a melody-only score first.' },
  { label: 'OFF', value: 'off', description: 'No score: straight to audio. Nothing to read BPM or key back from.' },
];

/** The settings panel's generate block for an extra engine (PLAN.md "Engine picker UI
 * decisions"): the engine's own controls from its descriptor, SEED when it has one, and one
 * line naming the ACE-Step settings it swaps out. Replaces model/LM/steps/guidance/advanced. */
export function EngineGenSettings({ engine }: { engine: EngineInfo }) {
  const stored = useEngineSettings((s) => s.values[engine.id]);
  const setControls = useEngineSettings((s) => s.set);
  const gen = useSettings((s) => s.gen);
  const setGen = useSettings((s) => s.setGen);
  const values = { ...AUTO_CONTROLS, ...stored };
  const caps = engine.capabilities;
  const onCover = useCreateDraftStore((s) => s.genType === 'audio');

  return (
    <>
      <div className="hint">{engine.label} — {aceOnlyNote(engine)}.</div>
      {caps.extraControls.map((control) => {
        if (control === 'cot') {
          // A cover sings a supplied score, so its plan mode is always `melody` (PLAN.md point 5).
          if (onCover) return <div key={control} className="hint">COT — a cover follows its score&apos;s melody (MELODY)</div>;
          return (
            <CustomSelect key={control} label="COT" value={values.cot} options={COT_OPTIONS}
              onChange={(v) => setControls(engine.id, { cot: v as Cot })} />
          );
        }
        const range = controlRange(engine.id, control);
        const value = values[control];
        return (
          <Slider key={control} label={SLIDERS[control].label} info={SLIDERS[control].info}
            value={value} min={range.min} max={range.max} step={range.step}
            readout={value === 0 ? 'AUTO' : undefined}
            onChange={(v) => setControls(engine.id, { [control]: v })} />
        );
      })}
      {caps.seed ? (
        <Seed random={gen.randomSeed} seed={gen.seed}
          onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
      ) : (
        <div className="setting setting-disabled">
          <div className="setting-head"><span>SEED</span><span className="val">N/A</span></div>
          <div className="hint">{engine.label} takes no seed — every result is a new take, not reproducible.</div>
        </div>
      )}
    </>
  );
}
