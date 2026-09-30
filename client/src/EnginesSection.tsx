import { useEffect } from 'react';
import type { EngineId, EngineInfo } from './api';
import { useEngineStore } from './engineStore';

/** What the server's env and each wrapper's README say, which the descriptor doesn't carry. */
const ENGINE_NOTES: Partial<Record<EngineId, { env: string; readme: string; license?: string; covers?: string }>> = {
  yue2: {
    env: 'YUE_API_URL',
    readme: 'yue-server/README.md',
    license: 'YuE2 weights: CC BY-NC 4.0 — individuals may use and monetize outputs; companies need a license from the authors.'
      + ' SheetSage2 weights: CC BY-NC 4.0.',
    covers: 'SheetSage2 on yue-server (YUE_SHEETSAGE_PYTHON / YUE_SHEETSAGE_DIR) — setup in yue-server/README.md section 5',
  },
  heartmula: { env: 'HEARTMULA_API_URL', readme: 'heartmula-server/README.md' },
};

function status(e: EngineInfo): { text: string; className: string } {
  if (!e.configured) return { text: 'NOT CONFIGURED', className: 'health' };
  return e.ready ? { text: 'READY', className: 'health ok' } : { text: 'UNREACHABLE', className: 'health down' };
}

/** Settings › Engines (PLAN.md design point 12): read-only. Engines are configured by env vars
 * on the server, so this card reports state and says where to change it rather than editing. */
export function EnginesSection() {
  const engines = useEngineStore((s) => s.engines);
  const loaded = useEngineStore((s) => s.loaded);
  useEffect(() => { void useEngineStore.getState().load(); }, []);

  const extras = engines.filter((e) => e.id !== 'acestep');
  const anyConfigured = extras.some((e) => e.configured);
  return (
    <div className="settings-card">
      <div className="settings-card-head"><span className="section-label">ENGINES</span></div>
      <div className="hint">
        optional models for a new song&apos;s first take, picked on Create › PROMPT (and COVER, for an engine that
        can cover) — every later edit runs on ACE-Step
      </div>
      {!loaded && <span className="meta">checking engines…</span>}
      {loaded && extras.length === 0 && <div className="empty">This server offers no extra engines.</div>}
      <div className="settings-model-list">
        {extras.map((e) => {
          const note = ENGINE_NOTES[e.id];
          const st = status(e);
          return (
            <div key={e.id} className="settings-model-row">
              <div>
                <div className="settings-model-name">{e.label}</div>
                {note && (
                  <div className="hint">
                    {e.configured ? `set by ${note.env} on the server` : `set ${note.env} on the server to enable it`}
                    {' '}— setup in {note.readme}
                  </div>
                )}
                {note?.covers && e.configured && (
                  <div className="hint">
                    COVERS: <span className={e.coverReady ? 'health ok' : 'health'} style={{ marginLeft: 4 }}>
                      {e.coverReady ? 'READY' : 'NOT SET UP'}
                    </span>
                    {e.coverReady ? '' : ` — needs ${note.covers}`}
                  </div>
                )}
                {note?.license && <div className="hint">{note.license}</div>}
              </div>
              <span className={st.className} style={{ marginLeft: 0 }}>{st.text}</span>
            </div>
          );
        })}
      </div>
      {anyConfigured && (
        <div className="warn-note">
          Run ACE-Step with ACESTEP_OFFLOAD_TO_CPU=true while an engine is configured — only one model fits in VRAM at a
          time. Mulakai can&apos;t read ACE-Step&apos;s startup settings, so this is a reminder, not a check.
        </div>
      )}
    </div>
  );
}
