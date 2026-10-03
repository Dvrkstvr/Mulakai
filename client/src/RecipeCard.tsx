import type { ReactNode } from 'react';
import { useCreateDraftStore } from './createDraftStore';
import { useEngineCaps } from './useEngineCaps';
import { useSettings } from './settings';
import { useEta } from './etaStore';
import { engineNote, etaLabel, GEN_TASK, recipeEtaKey } from './recipeCopy';
import { unsupported } from './engineCaps';
import { Slider } from './Slider';
import { NaSetting } from './SongDetailsFields';
import { RecipeQuality } from './RecipeQuality';
import { RecipeVoice } from './RecipeVoice';

const TAKES_INFO = 'Generates N candidates per request. Only one is currently kept — the rest are discarded.';

/** The RECIPE card (PLAN.md "S2 — Guided Create", point 3): how the song gets made, beside
 * the steps that say what it is. Top to bottom: ENGINE, QUALITY, VOICE, takes / time /
 * destination, TUNE, and the flow's commit. `stepsModel` is the model the flow runs (AUTO
 * resolved to the inventory default), which QUALITY and the time estimate key on;
 * `coverStepsAhead` counts an engine cover's remaining jobs (TRANSCRIBE, READ LYRICS, cover). */
export function RecipeCard({ engine, stepsModel, modelUnknownWhy = "the card's MODEL isn't picked yet", coverStepsAhead, tune, commit }: {
  engine: ReactNode;
  stepsModel: string;
  /** Why `stepsModel` is '' (not known yet), for QUALITY's hint. */
  modelUnknownWhy?: string;
  coverStepsAhead?: number;
  tune: ReactNode;
  commit: ReactNode;
}) {
  const genType = useCreateDraftStore((s) => s.genType);
  const folderName = useCreateDraftStore((s) => s.folderName);
  const { id: engineId, info } = useEngineCaps();
  const gen = useSettings((s) => s.gen);
  const eta = etaLabel(useEta(recipeEtaKey(genType, engineId, stepsModel, gen.quality)), coverStepsAhead);
  const caps = info?.capabilities ?? null;
  const takesLive = genType === 'prompt' && !unsupported('takes', caps);

  return (
    <aside className="recipe-card" aria-label="Recipe">
      <span className="recipe-title">RECIPE</span>
      <div className="recipe-field">
        <span className="section-label">ENGINE</span>
        {engine}
        <div className="hint">{engineNote(genType, info?.label ?? null)}</div>
      </div>
      <RecipeQuality stepsModel={stepsModel} unknownWhy={modelUnknownWhy}
        naReason={info ? `${info.label} has no step control` : null} />
      <RecipeVoice taskType={GEN_TASK[genType]}
        naReason={info && !caps?.referenceAudio ? `none · ${info.label} has no reference voice` : null} />
      {takesLive ? (
        <Slider label="TAKES" value={gen.batchSize} min={0} max={4} step={1} info={TAKES_INFO}
          readout={gen.batchSize === 0 ? 'AUTO (2)' : undefined}
          onChange={(v) => useSettings.getState().setGen({ batchSize: v })} />
      ) : <NaSetting label="TAKES" />}
      <dl className="recipe-facts">
        {eta && <div className="recipe-fact"><dt>Takes about</dt><dd>{eta}</dd></div>}
        <div className="recipe-fact"><dt>Lands in</dt><dd>{folderName ?? 'Library'}</dd></div>
      </dl>
      {tune}
      {commit}
    </aside>
  );
}
