import { useSettings } from './settings';
import { modelFamily } from './modelInfo';
import { QUALITY_PRESETS, qualityHint } from './qualitySteps';

/** QUALITY (PLAN.md "S2 — Guided Create", point 4): three presets that resolve to diffusion
 * steps at submit, by the family of `stepsModel` (the model the flow runs). A connected group
 * of sky chips — it's a choice of how, not a commit. Moving STEPS in TUNE lights none.
 * `unknownWhy` says why `stepsModel` isn't known yet, for the hint. */
export function RecipeQuality({ stepsModel, naReason, unknownWhy }: {
  stepsModel: string; naReason: string | null; unknownWhy: string;
}) {
  const quality = useSettings((s) => s.gen.quality);
  const setGen = useSettings((s) => s.setGen);

  if (naReason) {
    return (
      <div className="recipe-field">
        <div className="setting-head"><span className="section-label">QUALITY</span><span className="val">N/A</span></div>
        <div className="hint">{naReason}</div>
      </div>
    );
  }

  return (
    <div className="recipe-field">
      <span className="section-label">QUALITY</span>
      <div className="quality-chips" role="group" aria-label="Quality">
        {QUALITY_PRESETS.map((q) => (
          <button key={q} type="button" className={q === quality ? 'quality-chip active' : 'quality-chip'}
            aria-pressed={q === quality} onClick={() => setGen({ quality: q })}>
            <span>{q.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="hint">{qualityHint(quality, modelFamily(stepsModel), unknownWhy)}</div>
    </div>
  );
}
