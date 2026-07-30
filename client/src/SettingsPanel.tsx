import { useEffect, useState } from 'react';
import { api } from './api';
import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { ditModelDescription, lmModelDescription, stepsMax, guidanceEffective, autoSteps } from './modelInfo';
import { motion } from 'framer-motion';
import { Toggle } from './Toggle';
import { AdvancedGenSettings } from './AdvancedGenSettings';
import { ScrollArea } from './ScrollArea';
import { ReferenceAudioPicker } from './ReferenceAudioPicker';
import { AutoTextarea } from './AutoTextarea';
import { useAddLayerDraft } from './addLayerStore';

const STEPS_INFO = 'Diffusion steps — more steps means finer detail but slower generation. Turbo models: 1–20 (8 recommended). Base/SFT models: 32–100 recommended. AUTO picks the count the selected model wants (Turbo 8, SFT 50, Base 32).';

/** STEPS readout under AUTO. Shows the number AUTO will actually resolve to once a model is
 * picked; stays bare 'AUTO' for AUTO model, where only the server can know which checkpoint
 * ACE-Step will load (see server/src/services/inferenceSteps.ts). */
function autoStepsLabel(model: string): string {
  const steps = autoSteps(model);
  return steps === null ? 'AUTO' : `AUTO (${steps})`;
}
const GUIDANCE_INFO = 'Prompt adherence strength (CFG) — higher follows the prompt more strictly, but can overfit or sound artificial. Only affects Base/SFT models; Turbo ignores it. AUTO uses the model\'s own default.';

/** Risk scale for repaint VARIANCE (audio_cover_strength inverse) — see docs/design/DESIGN.md#Color-tokens. */
const VARIANCE_BANDS = [
  { max: 33, color: 'var(--sky)', label: 'SUBTLE', text: 'stays close to the original, small tweaks only' },
  { max: 66, color: 'var(--acid)', label: 'BALANCED', text: 'noticeable change, source still recognizable' },
  { max: 100, color: 'var(--rust)', label: 'BOLD', text: 'high freedom, may diverge far from the source to follow the prompt' },
];

export function VarianceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const band = VARIANCE_BANDS.find((b) => value <= b.max) ?? VARIANCE_BANDS[VARIANCE_BANDS.length - 1];
  return (
    <div className="variance-slider">
      <Slider label="VARIANCE" value={value} min={0} max={100} step={5} color={band.color} onChange={onChange} />
      <div className="variance-note" style={{ color: band.color }}>{band.label} — {band.text}</div>
    </div>
  );
}

function Seed({ random, seed, onRandom, onSeed }: {
  random: boolean; seed: number; onRandom: (v: boolean) => void; onSeed: (v: number) => void;
}) {
  return (
    <div className="setting">
      <Toggle label="RANDOM SEED" checked={random} onChange={onRandom} />
      {!random && (
        <input type="number" className="seed" value={seed} onChange={(e) => onSeed(Number(e.target.value))} />
      )}
    </div>
  );
}

export function SettingsPanel({ mode, hideLmControls, referenceAudioTaskType, addLayerActive, songLyrics }: {
  mode: 'generate' | 'repaint';
  hideLmControls?: boolean;
  /** Only meaningful for mode 'generate' — renders the shared ReferenceAudioPicker so its choice
   * persists across the PROMPT/AUDIO/ARRANGE tab switch. Omit to hide it (e.g. Editor screens
   * that reuse mode 'generate' contexts without a reference-audio concept). */
  referenceAudioTaskType?: 'text2music' | 'cover' | 'complete';
  /** mode 'repaint' only — Editor's Add Layer row is expanded, so this panel is the shared
   * Add Layer settings surface: it shows the lyrics editor + LM controls and gates advanced
   * knobs on the Base (lego) model instead of repaint's model. */
  addLayerActive?: boolean;
  /** The song's current lyrics, offered as a one-click prefill for the Add Layer lyrics editor. */
  songLyrics?: string;
}) {
  const { gen, repaint, addLayer, setGen, setRepaint } = useSettings();
  const lyrics = useAddLayerDraft((s) => s.lyrics);
  const setLyrics = useAddLayerDraft((s) => s.setLyrics);
  const [models, setModels] = useState<string[]>([]);
  const [lmModels, setLmModels] = useState<string[]>([]);
  // Advanced knobs (shift/ADG/CFG-interval) only affect Base models; when Add Layer is active
  // the model is its Base lego model, otherwise repaint's own DiT model.
  const gatingModel = addLayerActive ? addLayer.model : repaint.model;

  useEffect(() => {
    api.listModels().then((data) => {
      setModels(data.models.map((m) => m.name));
      setLmModels(data.lmModels);
    }).catch(() => {
      setModels([]);
      setLmModels([]);
    });
  }, []);

  const AUTO = { label: 'AUTO', value: '' };

  return (
    <motion.aside layout className="settings-panel" transition={{ duration: 0.2 }}>
      <motion.div layout="position" className="section-label">{mode === 'generate' ? 'GENERATION' : addLayerActive ? 'ADD LAYER' : 'REPAINT'} SETTINGS</motion.div>

      <ScrollArea className="settings-panel-scroll">
      {mode === 'generate' ? (
        <>
          <CustomSelect
            label="DIT MODEL"
            value={gen.model}
            onChange={(v) => setGen({ model: v, inferenceSteps: Math.min(gen.inferenceSteps, stepsMax(v)) })}
            options={[{ ...AUTO, description: ditModelDescription('') }, ...models.map(m => ({ label: m, value: m, description: ditModelDescription(m) }))]}
          />
          {!hideLmControls && (
            <>
              <CustomSelect
                label="LM MODEL"
                value={gen.lmModel}
                onChange={(v) => setGen({ lmModel: v })}
                options={[{ ...AUTO, description: lmModelDescription('') }, ...lmModels.map(m => ({ label: m, value: m, description: lmModelDescription(m) }))]}
              />
              <Toggle label="THINKING MODE" checked={gen.thinking} onChange={(v) => setGen({ thinking: v })} ai />
              <Toggle label="AI ENHANCE" checked={gen.useFormat} onChange={(v) => setGen({ useFormat: v })} ai />
            </>
          )}
          <Slider label="STEPS" value={gen.inferenceSteps} min={0} max={stepsMax(gen.model)} step={1}
            readout={gen.inferenceSteps === 0 ? autoStepsLabel(gen.model) : undefined} info={STEPS_INFO}
            onChange={(v) => setGen({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={gen.guidanceScale} min={0} max={15} step={0.5}
            readout={!guidanceEffective(gen.model) ? 'N/A' : gen.guidanceScale === 0 ? 'AUTO' : undefined}
            info={GUIDANCE_INFO} disabled={!guidanceEffective(gen.model)}
            onChange={(v) => setGen({ guidanceScale: v })} />
          <Seed random={gen.randomSeed} seed={gen.seed}
            onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
          <AdvancedGenSettings adv={gen} setAdv={setGen} gatingModel={gen.model} hideLmControls={hideLmControls} />
          {referenceAudioTaskType && <ReferenceAudioPicker taskType={referenceAudioTaskType} />}
        </>
      ) : (
        <>
          {addLayerActive ? (
            <div className="setting">
              <div className="setting-head">
                <span>LYRICS</span>
                {songLyrics?.trim() && (
                  <button className="linkish" onClick={() => setLyrics(songLyrics)}>USE SONG LYRICS</button>
                )}
              </div>
              <AutoTextarea
                placeholder="Leave blank for an instrumental layer, or type/paste lyrics to sing"
                value={lyrics}
                onChange={setLyrics}
              />
            </div>
          ) : (
            <>
              <CustomSelect
                label="DIT MODEL"
                value={repaint.model}
                onChange={(v) => setRepaint({ model: v, inferenceSteps: Math.min(repaint.inferenceSteps, stepsMax(v)) })}
                options={[{ ...AUTO, description: ditModelDescription('') }, ...models.map(m => ({ label: m, value: m, description: ditModelDescription(m) }))]}
              />
              <VarianceSlider value={Math.round(repaint.repaintStrength * 100)}
                onChange={(v) => setRepaint({ repaintStrength: v / 100 })} />
            </>
          )}
          <Slider label="STEPS" value={repaint.inferenceSteps} min={0} max={stepsMax(gatingModel)} step={1}
            readout={repaint.inferenceSteps === 0 ? autoStepsLabel(gatingModel) : undefined} info={STEPS_INFO}
            onChange={(v) => setRepaint({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={repaint.guidanceScale} min={0} max={15} step={0.5}
            readout={!guidanceEffective(gatingModel) ? 'N/A' : repaint.guidanceScale === 0 ? 'AUTO' : undefined}
            info={GUIDANCE_INFO} disabled={!guidanceEffective(gatingModel)}
            onChange={(v) => setRepaint({ guidanceScale: v })} />
          <Seed random={repaint.randomSeed} seed={repaint.seed}
            onRandom={(v) => setRepaint({ randomSeed: v })} onSeed={(v) => setRepaint({ seed: v })} />
          <AdvancedGenSettings adv={repaint} setAdv={setRepaint} gatingModel={gatingModel} hideLmControls={!addLayerActive} />
        </>
      )}
      </ScrollArea>
    </motion.aside>
  );
}
