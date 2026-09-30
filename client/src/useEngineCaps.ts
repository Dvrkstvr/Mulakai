import { useCreateDraftStore } from './createDraftStore';
import { extraEngine, useEngineStore } from './engineStore';
import type { EngineId, EngineInfo } from './api';

export interface SelectedEngine {
  /** Where GENERATE sends this draft. Always 'acestep' outside the PROMPT tab. */
  id: EngineId;
  /** The extra engine's descriptor and health; null for ACE-Step. */
  info: EngineInfo | null;
  /** The draft names an extra engine that can't take a job right now (not listed, not
   * configured, or not answering). GENERATE is disabled and a warn-note says why. */
  unavailable: boolean;
}

/** The engine the Create draft targets, resolved against the server's engine list. Every
 * gated control and the settings panel read this. */
export function useEngineCaps(): SelectedEngine {
  const genType = useCreateDraftStore((s) => s.genType);
  const engine = useCreateDraftStore((s) => s.engine);
  const engines = useEngineStore((s) => s.engines);
  const loaded = useEngineStore((s) => s.loaded);
  const id: EngineId = genType === 'prompt' ? engine : 'acestep';
  const info = extraEngine(engines, id);
  const unavailable = id !== 'acestep' && loaded && !(info?.configured && info.ready);
  return { id, info, unavailable };
}
