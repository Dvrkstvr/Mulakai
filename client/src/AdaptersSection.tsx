import { useEffect, useState } from 'react';
import { type Adapter } from './api';
import { useAdapterStore, activeAdapter, adapterConsequence } from './adapterStore';
import { AdapterAddForm } from './AdapterAddForm';
import { Slider } from './Slider';

/**
 * Settings > Adapters. One adapter is active app-wide because that is what ACE-Step actually
 * supports — `/release_task` has no adapter parameter, so whatever is loaded colours every
 * generate/repaint/layer/remaster. Training lives outside Mulakai (see FORGE_PLAN.md); this
 * card only points at adapters that already exist.
 */
export function AdaptersSection() {
  const { adapters, activeId, warning, fetchAdapters, select, remove } = useAdapterStore();
  const active = useAdapterStore(activeAdapter);
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    fetchAdapters().catch(() => {});
  }, [fetchAdapters]);

  const onDelete = (id: string) => {
    if (armed !== id) return setArmed(id);
    setArmed(null);
    remove(id).catch(() => {});
  };

  return (
    <div className="settings-card">
      <span className="section-label">ADAPTERS</span>
      <div className="hint">
        LoRA/LoKr adapters ACE-Step loads before generating — train them elsewhere (Side-Step,
        ACE-Step&#39;s own trainer) and register where they live here
      </div>

      <div className="settings-model-list">
        <div className="settings-model-row">
          <div>
            <div className="settings-model-name">NONE</div>
            <div className="hint">base model, unmodified</div>
          </div>
          {activeId === null ? (
            <span className="mk-badge default">ACTIVE</span>
          ) : (
            <button className="voice-manage-btn" onClick={() => select(null).catch(() => {})}>
              <span>SELECT</span>
            </button>
          )}
        </div>

        {adapters.map((a) => (
          <div key={a.id} className="settings-model-row">
            <div>
              <div className="settings-model-name">{a.name}</div>
              <div className="hint">{a.kind.toUpperCase()} · {a.path}</div>
            </div>
            <div className="adapter-row-actions">
              {activeId === a.id ? (
                <span className="mk-badge default">ACTIVE</span>
              ) : (
                <button className="voice-manage-btn" onClick={() => select(a.id).catch(() => {})}>
                  <span>SELECT</span>
                </button>
              )}
              <button
                className={armed === a.id ? 'voice-manage-btn adapter-del armed' : 'voice-manage-btn adapter-del'}
                onClick={() => onDelete(a.id)}
                onBlur={() => setArmed((cur) => (cur === a.id ? null : cur))}
              >
                <span>{armed === a.id ? 'DELETE? CONFIRM' : '✕'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {adapters.length === 0 && <div className="empty">No adapters registered.</div>}

      {active && <AdapterStrength adapter={active} />}
      <div className="hint">{adapterConsequence(active)}</div>
      {warning && <div className="warn-note">{warning}</div>}

      <AdapterAddForm />
    </div>
  );
}

function AdapterStrength({ adapter }: { adapter: Adapter }) {
  const setScale = useAdapterStore((s) => s.setScale);
  const [value, setValue] = useState(adapter.scale);

  useEffect(() => {
    setValue(adapter.scale);
  }, [adapter.id, adapter.scale]);

  // Committing tells ACE-Step to re-apply the scale, so a drag would otherwise fire one
  // request per pixel moved.
  useEffect(() => {
    if (value === adapter.scale) return;
    const timer = setTimeout(() => {
      setScale(adapter.id, value).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [value, adapter.id, adapter.scale, setScale]);

  return (
    <Slider
      label="STRENGTH"
      value={Math.round(value * 100)}
      min={0}
      max={100}
      step={5}
      readout={`${Math.round(value * 100)}%`}
      onChange={(v) => setValue(v / 100)}
      info="How strongly the adapter colours the result. ACE-Step accepts 0-100%; 100% is the adapter as trained."
    />
  );
}
