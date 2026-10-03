import { useSettings } from './settings';
import { CustomSelect } from './CustomSelect';
import { ditModelDescription } from './modelInfo';
import { RepaintKnobs } from './RepaintKnobs';
import { TuneDisclosure } from './TuneDisclosure';
import { tuneSummary } from './tuneSummary';

/** ADD LAYER's TUNE: the lego-capable DIT MODEL (Base only) plus the knobs it shares with REPAINT. */
export function AddLayerTune({ legoModels }: { legoModels: string[] }) {
  const repaint = useSettings((s) => s.repaint);
  const addLayer = useSettings((s) => s.addLayer);
  const setAddLayer = useSettings((s) => s.setAddLayer);
  return (
    <TuneDisclosure summary={tuneSummary(addLayer.model, repaint)}>
      <CustomSelect
        label="DIT MODEL"
        value={addLayer.model}
        onChange={(v) => setAddLayer({ model: v })}
        options={legoModels.map((m) => ({ label: m, value: m, description: ditModelDescription(m) }))}
      />
      <RepaintKnobs gatingModel={addLayer.model} />
    </TuneDisclosure>
  );
}
