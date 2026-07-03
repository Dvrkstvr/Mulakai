import { useEffect, useState } from 'react';
import { api } from './api';
import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { motion } from 'framer-motion';

/** Risk scale for repaint VARIANCE (audio_cover_strength inverse) — see docs/design/DESIGN.md#Color-tokens. */
const VARIANCE_BANDS = [
  { max: 33, color: 'var(--sky)', label: 'SUBTLE', text: 'stays close to the original, small tweaks only' },
  { max: 66, color: 'var(--acid)', label: 'BALANCED', text: 'noticeable change, source still recognizable' },
  { max: 100, color: 'var(--rust)', label: 'BOLD', text: 'high freedom, may diverge far from the source to follow the prompt' },
];

function VarianceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const band = VARIANCE_BANDS.find((b) => value <= b.max) ?? VARIANCE_BANDS[VARIANCE_BANDS.length - 1];
  return (
    <div className="variance-slider">
      <Slider label="VARIANCE" value={value} min={0} max={100} step={5} color={band.color} onChange={onChange} />
      <div className="variance-note" style={{ color: band.color }}>{band.label} — {band.text}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange, ai }: { label: string; checked: boolean; onChange: (v: boolean) => void; ai?: boolean }) {
  const cls = ['toggle', checked && 'on', checked && ai && 'toggle-ai'].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={() => onChange(!checked)}>
      <span>{label}</span><span className="dot" />
    </button>
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

export function SettingsPanel({ mode, hideLmControls }: { mode: 'generate' | 'repaint'; hideLmControls?: boolean }) {
  const { gen, repaint, setGen, setRepaint } = useSettings();
  const [models, setModels] = useState<string[]>([]);
  const [lmModels, setLmModels] = useState<string[]>([]);

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
      <motion.div layout="position" className="section-label">{mode === 'generate' ? 'GENERATION' : 'REPAINT'} SETTINGS</motion.div>

      {mode === 'generate' ? (
        <>
          <CustomSelect
            label="DIT MODEL"
            value={gen.model}
            onChange={(v) => setGen({ model: v })}
            options={[AUTO, ...models.map(m => ({label: m, value: m}))]}
          />
          {!hideLmControls && (
            <>
              <CustomSelect
                label="LM MODEL"
                value={gen.lmModel}
                onChange={(v) => setGen({ lmModel: v })}
                options={[AUTO, ...lmModels.map(m => ({label: m, value: m}))]}
              />
              <Toggle label="THINKING MODE" checked={gen.thinking} onChange={(v) => setGen({ thinking: v })} ai />
              <Toggle label="AI ENHANCE" checked={gen.useFormat} onChange={(v) => setGen({ useFormat: v })} ai />
            </>
          )}
          <Slider label="STEPS" value={gen.inferenceSteps} min={0} max={64} step={1}
            readout={gen.inferenceSteps === 0 ? 'AUTO' : undefined}
            onChange={(v) => setGen({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={gen.guidanceScale} min={0} max={15} step={0.5}
            readout={gen.guidanceScale === 0 ? 'AUTO' : undefined}
            onChange={(v) => setGen({ guidanceScale: v })} />
          <Seed random={gen.randomSeed} seed={gen.seed}
            onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
        </>
      ) : (
        <>
          <CustomSelect
            label="DIT MODEL"
            value={repaint.model}
            onChange={(v) => setRepaint({ model: v })}
            options={[AUTO, ...models.map(m => ({label: m, value: m}))]}
          />
          <VarianceSlider value={Math.round(repaint.repaintStrength * 100)}
            onChange={(v) => setRepaint({ repaintStrength: v / 100 })} />
          <Slider label="STEPS" value={repaint.inferenceSteps} min={0} max={64} step={1}
            readout={repaint.inferenceSteps === 0 ? 'AUTO' : undefined}
            onChange={(v) => setRepaint({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={repaint.guidanceScale} min={0} max={15} step={0.5}
            readout={repaint.guidanceScale === 0 ? 'AUTO' : undefined}
            onChange={(v) => setRepaint({ guidanceScale: v })} />
          <Seed random={repaint.randomSeed} seed={repaint.seed}
            onRandom={(v) => setRepaint({ randomSeed: v })} onSeed={(v) => setRepaint({ seed: v })} />
        </>
      )}
    </motion.aside>
  );
}
