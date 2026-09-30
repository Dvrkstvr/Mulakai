import type { EngineInfo } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { pickerEngines, unavailableReason } from './engineCaps';
import { useEngineStore } from './engineStore';
import { useEngineCaps } from './useEngineCaps';

type Choice = Pick<EngineInfo, 'id' | 'label' | 'configured' | 'ready'>;

/** The PROMPT tab's ENGINE row: which model makes the first take (PLAN.md design point 11).
 * Sky, not acid — picking an engine targets where the request goes; GENERATE commits it.
 * Renders nothing until some extra engine is configured, so a default install is unchanged. */
export function EngineChoice() {
  const engines = useEngineStore((s) => s.engines);
  const loaded = useEngineStore((s) => s.loaded);
  const engine = useCreateDraftStore((s) => s.engine);
  const patch = useCreateDraftStore((s) => s.patch);
  const { info, unavailable } = useEngineCaps();

  const choices: Choice[] = pickerEngines(engines);
  // A reused draft can name an engine that is no longer configured: keep it visible (and
  // selected) so the draft says what it asks for, next to ACE-STEP as the way out.
  if (engine !== 'acestep' && !choices.some((e) => e.id === engine)) {
    if (!choices.some((e) => e.id === 'acestep')) {
      choices.unshift(engines.find((e) => e.id === 'acestep')
        ?? { id: 'acestep', label: 'ACE-STEP', configured: true, ready: true });
    }
    choices.push(info ?? { id: engine, label: engine.toUpperCase(), configured: false, ready: false });
  }
  if (choices.length === 0) return null;

  const blocked = choices.filter((e) => e.id !== 'acestep' && unavailableReason(e));
  const selected = choices.find((e) => e.id === engine);
  return (
    <>
      <div className="field-label-row"><span className="section-label">ENGINE</span></div>
      <div className="type-tabs">
        {choices.map((e) => {
          const reason = e.id === 'acestep' ? '' : unavailableReason(e);
          return (
            <button key={e.id} className={e.id === engine ? 'tab engine-tab active' : 'tab engine-tab'}
              disabled={!!reason && e.id !== engine} title={reason || undefined}
              onClick={() => patch({ engine: e.id })}>
              <span>{e.label}</span>
            </button>
          );
        })}
      </div>
      {blocked.filter((e) => e.id !== engine).map((e) => (
        <div key={e.id} className="hint">{e.label} — {unavailableReason(e)}</div>
      ))}
      {unavailable && loaded && selected && (
        <div className="warn-note">
          {selected.label} can&apos;t take a job right now — {unavailableReason(selected)}. GENERATE is off until
          it is back, or switch to ACE-STEP.
        </div>
      )}
    </>
  );
}
