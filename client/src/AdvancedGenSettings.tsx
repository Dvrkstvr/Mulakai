import { useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { guidanceEffective } from './modelInfo';
import type { GenSettings } from './settings';

const INFER_METHOD_OPTIONS = [
  { label: 'AUTO', value: '' },
  { label: 'ODE (fast)', value: 'ode' },
  { label: 'SDE (stochastic)', value: 'sde' },
];

/**
 * Disclosure for the ACE-Step DiT/LM knobs beyond STEPS/GUIDANCE/SEED — collapsed by
 * default since most generations never need them (docs/ace-step-1.5/API.md#4.2, #4.3).
 */
export function AdvancedGenSettings({
  gen, setGen, hideLmControls,
}: {
  gen: GenSettings;
  setGen: (patch: Partial<GenSettings>) => void;
  hideLmControls?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const baseOnly = !guidanceEffective(gen.model); // true for Turbo — shift/ADG/CFG-interval are no-ops there

  return (
    <div className="advanced-gen-settings">
      <button className="advanced-toggle" onClick={() => setOpen(!open)}>
        <span>ADVANCED</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <Slider label="SHIFT" value={gen.shift} min={0} max={5} step={0.1}
            readout={baseOnly ? 'N/A' : gen.shift === 0 ? 'AUTO' : undefined} disabled={baseOnly}
            info="Timestep shift factor (1.0-5.0). Only effective for base models, not turbo." onChange={(v) => setGen({ shift: v })} />
          <CustomSelect label="INFER METHOD" value={gen.inferMethod}
            onChange={(v) => setGen({ inferMethod: v as GenSettings['inferMethod'] })} options={INFER_METHOD_OPTIONS} />
          <div className="setting">
            <div className="setting-head"><span>TIMESTEPS</span></div>
            <input placeholder="unset — e.g. 0.97,0.76,0.615,...&#10;overrides STEPS and SHIFT" value={gen.timesteps}
              onChange={(e) => setGen({ timesteps: e.target.value })} />
          </div>
          <Toggle label="ADAPTIVE DUAL GUIDANCE" checked={gen.useAdg} disabled={baseOnly}
            onChange={(v) => setGen({ useAdg: v })} />
          <Slider label="CFG INTERVAL START" value={gen.cfgIntervalStart} min={0} max={1} step={0.05}
            disabled={baseOnly} onChange={(v) => setGen({ cfgIntervalStart: v })} />
          <Slider label="CFG INTERVAL END" value={gen.cfgIntervalEnd} min={0} max={1} step={0.05}
            disabled={baseOnly} onChange={(v) => setGen({ cfgIntervalEnd: v })} />
          {!hideLmControls && (
            <>
              <Slider label="LM TEMPERATURE" value={gen.lmTemperature} min={0} max={2} step={0.05}
                onChange={(v) => setGen({ lmTemperature: v })} />
              <Slider label="LM CFG SCALE" value={gen.lmCfgScale} min={1} max={10} step={0.1}
                info="CFG scale for the LM planner — values above 1 enable CFG." onChange={(v) => setGen({ lmCfgScale: v })} />
              <div className="setting">
                <div className="setting-head"><span>LM NEGATIVE PROMPT</span></div>
                <input placeholder='AUTO ("NO USER INPUT")' value={gen.lmNegativePrompt}
                  onChange={(e) => setGen({ lmNegativePrompt: e.target.value })} />
              </div>
              <Slider label="LM TOP K" value={gen.lmTopK} min={0} max={100} step={1}
                readout={gen.lmTopK === 0 ? 'DISABLED' : undefined} onChange={(v) => setGen({ lmTopK: v })} />
              <Slider label="LM TOP P" value={gen.lmTopP} min={0} max={1} step={0.05}
                readout={gen.lmTopP >= 1 ? 'DISABLED' : undefined} onChange={(v) => setGen({ lmTopP: v })} />
              <Slider label="LM REPETITION PENALTY" value={gen.lmRepetitionPenalty} min={1} max={2} step={0.05}
                onChange={(v) => setGen({ lmRepetitionPenalty: v })} />
            </>
          )}
        </>
      )}
    </div>
  );
}
