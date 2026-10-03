import { useState, type ReactNode } from 'react';
import type { ModelInventory } from './api';
import { useSettings } from './settings';
import { useEngineCaps } from './useEngineCaps';
import { AUTO_CONTROLS, useEngineSettings } from './engineSettings';
import { guidanceEffective } from './modelInfo';
import { aceTuneChanges, engineTuneChanges, tuneSummary } from './recipeCopy';
import type { Lookup } from './lookup';
import { AceGenTune } from './AceGenTune';
import { EngineGenSettings } from './EngineGenSettings';

/** TUNE ▸ on the RECIPE card (PLAN.md "S2 — Guided Create", point 3): everything the old left
 * settings panel held for this flow, collapsed to one line naming what isn't default. An extra
 * engine swaps in its own controls, as the panel did. `modelDefault` is the flow's own default
 * model, so an auto-picked COVER/ARRANGE model doesn't read as a change. */
export function GenTune({ inventory, modelControl, flowModel, modelDefault = '', stepsModel }: {
  inventory: Lookup<ModelInventory> & { retry: () => void };
  modelControl?: ReactNode;
  flowModel?: string;
  modelDefault?: string;
  stepsModel: string;
}) {
  const [open, setOpen] = useState(false);
  const gen = useSettings((s) => s.gen);
  const { info: engine } = useEngineCaps();
  const stored = useEngineSettings((s) => (engine ? s.values[engine.id] : undefined));

  const model = flowModel ?? gen.model;
  const summary = engine
    ? tuneSummary(engineTuneChanges(engine.capabilities.extraControls, { ...AUTO_CONTROLS, ...stored },
      { live: engine.capabilities.seed, random: gen.randomSeed, value: gen.seed }), `${engine.label.toLowerCase()} controls, seed`)
    : tuneSummary(aceTuneChanges({
      model, defaultModel: modelDefault, customSteps: gen.quality === 'custom' ? gen.inferenceSteps : null,
      guidance: gen.guidanceScale, guidanceLive: guidanceEffective(model), randomSeed: gen.randomSeed, seed: gen.seed,
    }), 'model, steps, guidance, seed');

  return (
    <div className="recipe-tune">
      <button type="button" className="recipe-tune-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="recipe-tune-label">TUNE {open ? '▾' : '▸'}</span>
        <span className="recipe-tune-summary">{summary}</span>
      </button>
      {open && (
        <div className="recipe-tune-body">
          {engine ? <EngineGenSettings engine={engine} />
            : <AceGenTune inventory={inventory} modelControl={modelControl} flowModel={flowModel} stepsModel={stepsModel} />}
        </div>
      )}
    </div>
  );
}
