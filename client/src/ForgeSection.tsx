import { useSettings } from './settings';

/** Reveals FORGE's header icon (docs FORGE_PLAN.md). The screen behind it is a stub —
 * LoRA/dataset training itself is deferred until Mulakai reaches release 1.0. */
export function ForgeSection() {
  const forgeEnabled = useSettings((s) => s.forgeEnabled);
  const setForgeEnabled = useSettings((s) => s.setForgeEnabled);

  return (
    <div className="settings-card">
      <div className="settings-card-head">
        <span className="section-label" style={{ color: 'var(--lilac-text)' }}>FORGE (EXPERIMENTAL)</span>
        <button
          className={forgeEnabled ? 'tab active' : 'tab'}
          style={{ borderColor: 'var(--lilac)', color: forgeEnabled ? 'var(--carbon)' : 'var(--lilac-text)', background: forgeEnabled ? 'var(--lilac)' : 'transparent' }}
          onClick={() => setForgeEnabled(!forgeEnabled)}
        >
          <span>{forgeEnabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <div className="hint">
        LoRA/dataset training studio. Turning this on adds a small icon to the header — the screen behind
        it is a placeholder until Mulakai reaches release 1.0 (see FORGE_PLAN.md).
      </div>
    </div>
  );
}
