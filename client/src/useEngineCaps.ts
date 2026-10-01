import { useCreateDraftStore } from './createDraftStore';
import { extraEngine, useEngineStore } from './engineStore';
import type { EngineId, EngineInfo } from './api';

export interface SelectedEngine {
  /** Where GENERATE sends this draft: PROMPT's engine, COVER's own, and ACE-Step for ARRANGE. */
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
  const promptEngine = useCreateDraftStore((s) => s.engine);
  const coverEngine = useCreateDraftStore((s) => s.audio.engine);
  const engines = useEngineStore((s) => s.engines);
  const loaded = useEngineStore((s) => s.loaded);
  const id: EngineId = genType === 'prompt' ? promptEngine : genType === 'audio' ? coverEngine : 'acestep';
  const info = extraEngine(engines, id);
  const ready = genType === 'audio' ? info?.coverReady : info?.configured && info.ready;
  const unavailable = id !== 'acestep' && loaded && !ready;
  return { id, info, unavailable };
}
