import { useEffect, useState, useRef } from 'react';
import { api } from './api';
import { useSettings } from './settings';
import { motion, AnimatePresence } from 'framer-motion';

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

function CustomSelect({ label, value, options, onChange }: { label: string, value: string, options: { label: string, value: string }[], onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = options.find(o => o.value === value)?.label || '—';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="setting" ref={containerRef}>
      <div className="setting-head"><span>{label}</span></div>
      <div style={{ position: 'relative' }}>
        <motion.button
          className={`custom-select-button ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          animate={{ skewX: isOpen ? -10 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span>{currentLabel}</span>
          <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>
        </motion.button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="custom-select-dropdown"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {options.map((opt, i) => (
                <motion.div
                  key={opt.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                  className="custom-select-option"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                >
                  {opt.label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SettingsPanel({ mode }: { mode: 'generate' | 'repaint' }) {
  const { gen, repaint, setGen, setRepaint } = useSettings();
  const [models, setModels] = useState<string[]>([]);
  const [lmModels, setLmModels] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'generate') return;
    api.listModels().then((data) => {
      const ditNames = data.models.map((m) => m.name);
      setModels(ditNames);
      setLmModels(data.lmModels);
      // Ensure the dropdowns always show a real downloaded model.
      if (ditNames.length && !ditNames.includes(gen.model)) {
        setGen({ model: data.defaultModel ?? ditNames[0] });
      }
      if (data.lmModels.length && !data.lmModels.includes(gen.lmModel)) {
        setGen({ lmModel: data.lmModels[0] });
      }
    }).catch(() => {
      setModels([]);
      setLmModels([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <motion.aside layout className="settings-panel" transition={{ duration: 0.2 }}>
      <motion.div layout="position" className="section-label">{mode === 'generate' ? 'GENERATION' : 'REPAINT'} SETTINGS</motion.div>

      {mode === 'generate' ? (
        <>
          <CustomSelect 
            label="DIT MODEL" 
            value={gen.model} 
            onChange={(v) => setGen({ model: v })}
            options={models.map(m => ({label: m, value: m}))}
          />
          <CustomSelect
            label="LM MODEL"
            value={gen.lmModel}
            onChange={(v) => setGen({ lmModel: v })}
            options={lmModels.map(m => ({label: m, value: m}))}
          />
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
