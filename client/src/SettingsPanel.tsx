import { api } from './api';
import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { ditModelDescription, lmModelDescription, stepsMax, guidanceEffective } from './modelInfo';
import { STEPS_INFO, GUIDANCE_INFO, autoStepsLabel } from './knobInfo';
import { motion } from 'framer-motion';
import { Toggle } from './Toggle';
import { AdvancedGenSettings } from './AdvancedGenSettings';
import { ScrollArea } from './ScrollArea';
import { ReferenceAudioPicker } from './ReferenceAudioPicker';
import { Seed } from './Seed';
import { EngineGenSettings } from './EngineGenSettings';
import { useEngineCaps } from './useEngineCaps';
import { useLookup, SLOW_ACESTEP_NOTE } from './lookup';

export { VarianceSlider } from './VarianceSlider';

/** Create's generation settings. The Editor's repaint/add-layer knobs live under each dock verb's TUNE. */
export function SettingsPanel({ hideLmControls, hideThinking, coverModel, referenceAudioTaskType }: {
  mode: 'generate';
  hideLmControls?: boolean;
  /** Hides only THINKING MODE — for tasks where ACE-Step skips the in-generation LM but still
   * runs AI ENHANCE's API-side formatting (ARRANGE's `complete`). */
  hideThinking?: boolean;
  /** COVER · ACE-STEP: the tab's own MODEL pick, which is what the cover runs on. Hides DIT
   * MODEL here (it edits PROMPT's model) and gates STEPS/GUIDANCE/ADVANCED on this instead. */
  coverModel?: string;
  /** Renders the shared ReferenceAudioPicker so its choice persists across the
   * PROMPT/AUDIO/ARRANGE tab switch. Omit to hide it. */
  referenceAudioTaskType?: 'text2music' | 'cover' | 'complete';
}) {
  const { gen, setGen } = useSettings();
  // A failed list leaves AUTO, which needs no list; the error line says why the rest are missing.
  const inventory = useLookup(api.listModels);
  const models = inventory.data?.models.map((m) => m.name) ?? [];
  const lmModels = inventory.data?.lmModels ?? [];
  const genModel = coverModel ?? gen.model;
  // PROMPT on an extra engine: its own controls replace ACE-Step's whole generate block.
  const { info: engine } = useEngineCaps();

  const AUTO = { label: 'AUTO', value: '' };

  return (
    <motion.aside layout className="settings-panel" transition={{ duration: 0.2 }}>
      <motion.div layout="position" className="section-label">GENERATION SETTINGS</motion.div>

      <ScrollArea className="settings-panel-scroll">
      {inventory.error && !engine && (
        <div className="error">couldn't load the model list — {inventory.error} <button onClick={inventory.retry}>RETRY</button></div>
      )}
      {inventory.slow && !engine && (
        <div className="meta">loading the model list… {SLOW_ACESTEP_NOTE}</div>
      )}
      {engine ? (
        <EngineGenSettings engine={engine} />
      ) : (
        <>
          {coverModel === undefined && (
            <CustomSelect
              label="DIT MODEL"
              value={gen.model}
              onChange={(v) => setGen({ model: v, inferenceSteps: Math.min(gen.inferenceSteps, stepsMax(v)) })}
              options={[{ ...AUTO, description: ditModelDescription('') }, ...models.map(m => ({ label: m, value: m, description: ditModelDescription(m) }))]}
            />
          )}
          {!hideLmControls && (
            <>
              <CustomSelect
                label="LM MODEL"
                value={gen.lmModel}
                onChange={(v) => setGen({ lmModel: v })}
                options={[{ ...AUTO, description: lmModelDescription('') }, ...lmModels.map(m => ({ label: m, value: m, description: lmModelDescription(m) }))]}
              />
              {!hideThinking && (
                <Toggle label="THINKING MODE" checked={gen.thinking} onChange={(v) => setGen({ thinking: v })} ai />
              )}
              <Toggle label="AI ENHANCE" checked={gen.useFormat} onChange={(v) => setGen({ useFormat: v })} ai />
            </>
          )}
          <Slider label="STEPS" value={Math.min(gen.inferenceSteps, stepsMax(genModel))} min={0} max={stepsMax(genModel)} step={1}
            readout={gen.inferenceSteps === 0 ? autoStepsLabel(genModel) : undefined} info={STEPS_INFO}
            onChange={(v) => setGen({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={gen.guidanceScale} min={0} max={15} step={0.5}
            readout={!guidanceEffective(genModel) ? 'N/A' : gen.guidanceScale === 0 ? 'AUTO' : undefined}
            info={GUIDANCE_INFO} disabled={!guidanceEffective(genModel)}
            onChange={(v) => setGen({ guidanceScale: v })} />
          <Seed random={gen.randomSeed} seed={gen.seed}
            onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
          <AdvancedGenSettings adv={gen} setAdv={setGen} gatingModel={genModel} hideLmControls={hideLmControls} />
          {referenceAudioTaskType && <ReferenceAudioPicker taskType={referenceAudioTaskType} />}
        </>
      )}
      </ScrollArea>
    </motion.aside>
  );
}
