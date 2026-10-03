import { api } from './api';
import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { ditModelDescription, stepsMax } from './modelInfo';
import { useLookup, SLOW_ACESTEP_NOTE } from './lookup';
import { RepaintKnobs } from './RepaintKnobs';
import { TuneDisclosure } from './TuneDisclosure';
import { tuneSummary } from './tuneSummary';

/** REPAINT's TUNE: DIT MODEL plus the shared knobs (VARIANCE sits inline in the dock body). */
export function RepaintTune() {
  const repaint = useSettings((s) => s.repaint);
  const setRepaint = useSettings((s) => s.setRepaint);
  // A failed list leaves AUTO, which needs no list; the error line says why the rest are missing.
  const inventory = useLookup(api.listModels);
  const models = inventory.data?.models.map((m) => m.name) ?? [];
  return (
    <TuneDisclosure summary={tuneSummary(repaint.model, repaint)}>
      {inventory.error && (
        <div className="error">couldn't load the model list — {inventory.error} <button onClick={inventory.retry}>RETRY</button></div>
      )}
      {inventory.slow && <div className="meta">loading the model list… {SLOW_ACESTEP_NOTE}</div>}
      <CustomSelect
        label="DIT MODEL"
        value={repaint.model}
        onChange={(v) => setRepaint({ model: v, inferenceSteps: Math.min(repaint.inferenceSteps, stepsMax(v)) })}
        options={[{ label: 'AUTO', value: '', description: ditModelDescription('') },
          ...models.map((m) => ({ label: m, value: m, description: ditModelDescription(m) }))]}
      />
      <RepaintKnobs gatingModel={repaint.model} />
    </TuneDisclosure>
  );
}
