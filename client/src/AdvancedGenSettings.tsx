import { useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { InfoTooltip } from './InfoTooltip';
import { guidanceEffective } from './modelInfo';
import type { AdvancedSettings } from './settings';

const INFER_METHOD_OPTIONS = [
  { label: 'AUTO', value: '', description: "Uses the model's own default inference method." },
  { label: 'ODE (fast)', value: 'ode', description: 'Deterministic Euler solver — faster, and the same seed always reproduces the same result.' },
  { label: 'SDE (stochastic)', value: 'sde', description: 'Stochastic solver — adds randomness during sampling for more varied results at the same seed, at some cost to speed.' },
];

const TIMESTEPS_INFO = 'Custom comma-separated timestep schedule (e.g. 0.97,0.76,0.615,...). Overrides STEPS and SHIFT entirely — leave blank to let those control the schedule instead.';
const ADG_INFO = 'Dynamically balances guidance strength across the denoising process instead of applying GUIDANCE at one fixed strength throughout. Base/SFT models only.';
const CFG_START_INFO = 'Point in the denoising process (0-1) where CFG guidance starts being applied. Raising it delays guidance, giving early steps more freedom before the prompt takes hold.';
const CFG_END_INFO = 'Point in the denoising process (0-1) where CFG guidance stops being applied. Lowering it lets later steps run without guidance, which can loosen up fine detail.';
const LM_TEMPERATURE_INFO = "Sampling randomness for the LM planner — higher values give more varied/unpredictable lyric and structure planning, lower values make it more deterministic and repetitive.";
const LM_NEGATIVE_PROMPT_INFO = 'Text the LM planner is steered away from when LM CFG SCALE is above 1. AUTO uses a fixed "no user input" placeholder.';
const LM_TOP_K_INFO = 'Limits the LM planner to its K most likely next tokens — lower values make planning more focused/predictable, 0 disables the limit.';
const LM_TOP_P_INFO = "Limits the LM planner to the smallest set of next tokens whose combined probability exceeds P — lower values make planning more focused, values at/above 1 disable the limit.";
const LM_REPETITION_PENALTY_INFO = 'Penalizes the LM planner for reusing tokens it already output — higher values reduce repetitive lyric/structure patterns but can hurt coherence.';

/**
 * Disclosure for the ACE-Step DiT/LM knobs beyond STEPS/GUIDANCE/SEED — collapsed by
 * default since most generations never need them (docs/ace-step-1.5/API.md#4.2, #4.3).
 */
export function AdvancedGenSettings({
  adv, setAdv, gatingModel, hideLmControls,
}: {
  adv: AdvancedSettings;
  setAdv: (patch: Partial<AdvancedSettings>) => void;
  /** DiT model that decides whether shift/ADG/CFG-interval have any effect —
   * the *active* action's model (repaint's, or Add Layer's Base model). */
  gatingModel: string;
  hideLmControls?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const baseOnly = !guidanceEffective(gatingModel); // true for Turbo — shift/ADG/CFG-interval are no-ops there

  return (
    <div className="advanced-gen-settings">
      <button className="advanced-toggle" onClick={() => setOpen(!open)}>
        <span>ADVANCED</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <Slider label="SHIFT" value={adv.shift} min={0} max={5} step={0.1}
            readout={baseOnly ? 'N/A' : adv.shift === 0 ? 'AUTO' : undefined} disabled={baseOnly}
            info="Timestep shift factor (1.0-5.0). Only effective for base models, not turbo." onChange={(v) => setAdv({ shift: v })} />
          <CustomSelect label="INFER METHOD" value={adv.inferMethod}
            onChange={(v) => setAdv({ inferMethod: v as AdvancedSettings['inferMethod'] })} options={INFER_METHOD_OPTIONS} />
          <div className="setting">
            <div className="setting-head"><span>TIMESTEPS<InfoTooltip text={TIMESTEPS_INFO} /></span></div>
            <input placeholder="unset — e.g. 0.97,0.76,0.615,...&#10;overrides STEPS and SHIFT" value={adv.timesteps}
              onChange={(e) => setAdv({ timesteps: e.target.value })} />
          </div>
          <Toggle label="ADAPTIVE DUAL GUIDANCE" checked={adv.useAdg} disabled={baseOnly} info={ADG_INFO}
            onChange={(v) => setAdv({ useAdg: v })} />
          <Slider label="CFG INTERVAL START" value={adv.cfgIntervalStart} min={0} max={1} step={0.05}
            disabled={baseOnly} info={CFG_START_INFO} onChange={(v) => setAdv({ cfgIntervalStart: v })} />
          <Slider label="CFG INTERVAL END" value={adv.cfgIntervalEnd} min={0} max={1} step={0.05}
            disabled={baseOnly} info={CFG_END_INFO} onChange={(v) => setAdv({ cfgIntervalEnd: v })} />
          {!hideLmControls && (
            <>
              <Slider label="LM TEMPERATURE" value={adv.lmTemperature} min={0} max={2} step={0.05}
                info={LM_TEMPERATURE_INFO} onChange={(v) => setAdv({ lmTemperature: v })} />
              <Slider label="LM CFG SCALE" value={adv.lmCfgScale} min={1} max={10} step={0.1}
                info="CFG scale for the LM planner — values above 1 enable CFG." onChange={(v) => setAdv({ lmCfgScale: v })} />
              <div className="setting">
                <div className="setting-head"><span>LM NEGATIVE PROMPT<InfoTooltip text={LM_NEGATIVE_PROMPT_INFO} /></span></div>
                <input placeholder='AUTO ("NO USER INPUT")' value={adv.lmNegativePrompt}
                  onChange={(e) => setAdv({ lmNegativePrompt: e.target.value })} />
              </div>
              <Slider label="LM TOP K" value={adv.lmTopK} min={0} max={100} step={1}
                readout={adv.lmTopK === 0 ? 'DISABLED' : undefined} info={LM_TOP_K_INFO} onChange={(v) => setAdv({ lmTopK: v })} />
              <Slider label="LM TOP P" value={adv.lmTopP} min={0} max={1} step={0.05}
                readout={adv.lmTopP >= 1 ? 'DISABLED' : undefined} info={LM_TOP_P_INFO} onChange={(v) => setAdv({ lmTopP: v })} />
              <Slider label="LM REPETITION PENALTY" value={adv.lmRepetitionPenalty} min={1} max={2} step={0.05}
                info={LM_REPETITION_PENALTY_INFO} onChange={(v) => setAdv({ lmRepetitionPenalty: v })} />
            </>
          )}
        </>
      )}
    </div>
  );
}
