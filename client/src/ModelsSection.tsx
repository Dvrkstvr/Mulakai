import { useEffect, useState } from 'react';
import { api, type ModelInventory } from './api';
import { useSettings } from './settings';
import { ditModelDescription, lmModelDescription } from './modelInfo';

interface Props {
  online: boolean | null;
}

/** Model inventory + default-model pickers. "Default" here is literally Create's own
 * per-mode model select (settings.ts's gen.model/gen.lmModel) — shown here too so it's
 * reachable without opening Create. ACE-Step's API has no download/update-model endpoint
 * (docs/ace-step-1.5/API.md), so this section is read/select only, not a model manager. */
export function ModelsSection({ online }: Props) {
  const gen = useSettings((s) => s.gen);
  const setGen = useSettings((s) => s.setGen);
  const [inventory, setInventory] = useState<ModelInventory | null>(null);

  useEffect(() => {
    api.listModels().then(setInventory).catch(() => setInventory({ models: [], lmModels: [], defaultModel: null }));
  }, []);

  return (
    <div className="settings-card">
      <div className="settings-card-head">
        <span className="section-label">MODELS</span>
        <span className={`health ${online ? 'ok' : 'down'}`} style={{ marginLeft: 0 }}>
          ACE-STEP {online === null ? '…' : online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div className="hint">default DIT/LM model used next time Create opens — ACE-Step has no download/update API, so models must already be installed on the server</div>

      {inventory === null ? (
        <span className="meta">loading model inventory…</span>
      ) : (
        <>
          <div className="settings-model-list">
            {inventory.models.map((m) => (
              <div key={m.name} className="settings-model-row">
                <div>
                  <div className="settings-model-name">{m.name}</div>
                  <div className="hint">{ditModelDescription(m.name)}</div>
                </div>
                {gen.model === m.name ? (
                  <span className="mk-badge default">DEFAULT</span>
                ) : (
                  <button className="voice-manage-btn" onClick={() => setGen({ model: m.name })}>
                    <span>SET DEFAULT</span>
                  </button>
                )}
              </div>
            ))}
            {inventory.models.length === 0 && <div className="empty">No DIT models reported by ACE-Step.</div>}
          </div>

          <div className="settings-model-list">
            {inventory.lmModels.map((name) => (
              <div key={name} className="settings-model-row">
                <div>
                  <div className="settings-model-name">{name}</div>
                  <div className="hint">{lmModelDescription(name)}</div>
                </div>
                {gen.lmModel === name ? (
                  <span className="mk-badge default">DEFAULT</span>
                ) : (
                  <button className="voice-manage-btn" onClick={() => setGen({ lmModel: name })}>
                    <span>SET DEFAULT</span>
                  </button>
                )}
              </div>
            ))}
            {inventory.lmModels.length === 0 && <div className="empty">No LM models reported by ACE-Step.</div>}
          </div>
        </>
      )}
    </div>
  );
}
