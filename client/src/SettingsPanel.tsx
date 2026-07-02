import { useEffect, useState } from 'react';
import { api } from './api';
import { useSettings } from './settings';
import { motion } from 'framer-motion';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="setting">
      <div className="setting-head"><span>{label}</span><span className="val">{value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={checked ? 'toggle on' : 'toggle'} onClick={() => onChange(!checked)}>
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

export function SettingsPanel({ mode }: { mode: 'generate' | 'repaint' }) {
  const { gen, repaint, setGen, setRepaint } = useSettings();
  const [models, setModels] = useState<string[]>([]);
  const [lmModels, setLmModels] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'generate') {
      api.listModels().then((data) => {
        setModels(data.models);
        setLmModels(data.lmModels);
      }).catch(() => {
        setModels([]);
        setLmModels([]);
      });
    }
  }, [mode]);

  return (
    <motion.aside layout className="settings-panel" transition={{ duration: 0.2 }}>
      <motion.div layout="position" className="section-label">{mode === 'generate' ? 'GENERATION' : 'REPAINT'} SETTINGS</motion.div>

      {mode === 'generate' ? (
        <>
          <div className="setting">
            <div className="setting-head"><span>DIT MODEL</span></div>
            <select value={gen.model} onChange={(e) => setGen({ model: e.target.value })}>
              <option value="">Default</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="setting">
            <div className="setting-head"><span>LM MODEL</span></div>
            <select value={gen.lmModel} onChange={(e) => setGen({ lmModel: e.target.value })}>
              <option value="">Default</option>
              {lmModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Toggle label="THINKING MODE" checked={gen.thinking} onChange={(v) => setGen({ thinking: v })} />
          <Toggle label="AI ENHANCE" checked={gen.useFormat} onChange={(v) => setGen({ useFormat: v })} />
          <Slider label="STEPS" value={gen.inferenceSteps} min={1} max={64} step={1}
            onChange={(v) => setGen({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={gen.guidanceScale} min={1} max={15} step={0.5}
            onChange={(v) => setGen({ guidanceScale: v })} />
          <Seed random={gen.randomSeed} seed={gen.seed}
            onRandom={(v) => setGen({ randomSeed: v })} onSeed={(v) => setGen({ seed: v })} />
        </>
      ) : (
        <>
          <div className="setting">
            <div className="setting-head"><span>MODE</span></div>
            <div className="seg">
              {(['conservative', 'balanced', 'aggressive'] as const).map((m) => (
                <button key={m} className={repaint.repaintMode === m ? 'on' : ''}
                  onClick={() => setRepaint({ repaintMode: m })}>{m.slice(0, 4).toUpperCase()}</button>
              ))}
            </div>
          </div>
          <Slider label="VARIANCE" value={Math.round(repaint.repaintStrength * 100)} min={0} max={100} step={5}
            onChange={(v) => setRepaint({ repaintStrength: v / 100 })} />
          <Slider label="STEPS" value={repaint.inferenceSteps} min={1} max={64} step={1}
            onChange={(v) => setRepaint({ inferenceSteps: v })} />
          <Slider label="GUIDANCE" value={repaint.guidanceScale} min={1} max={15} step={0.5}
            onChange={(v) => setRepaint({ guidanceScale: v })} />
          <Seed random={repaint.randomSeed} seed={repaint.seed}
            onRandom={(v) => setRepaint({ randomSeed: v })} onSeed={(v) => setRepaint({ seed: v })} />
        </>
      )}
    </motion.aside>
  );
}
