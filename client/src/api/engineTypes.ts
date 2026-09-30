/** Wire types for the song-creation engines — mirrors server/src/services/engines/types.ts
 * and registry.ts's `GET /api/engines` payload (PLAN.md "Multiple Song-Creation Engines"). */

/** 'acestep' is the built-in engine; the rest are optional first-take engines. */
export type EngineId = 'acestep' | 'yue2' | 'heartmula';

export type EngineControl = 'cfg' | 'temperature' | 'topK' | 'cot';

/** Static per engine: what the model can take, which drives Create's in-place N/A gating. */
export interface EngineCapabilities {
  duration: 'exact' | 'max' | 'none';
  musicalMeta: 'params' | 'style-text' | 'none';
  referenceAudio: boolean;
  adapters: boolean;
  seed: boolean;
  languages: string[] | 'any';
  sectionTags: string[] | null;
  lmTools: boolean;
  advanced: boolean;
  takes: boolean;
  extraControls: EngineControl[];
  /** The inline consequence line under GENERATE; '' = none. */
  consequence: string;
}

export interface EngineInfo {
  id: EngineId;
  label: string;
  capabilities: EngineCapabilities;
  /** Its URL is set on the server. */
  configured: boolean;
  /** Its health check answered just now. */
  ready: boolean;
  /** COVER can run on it now: it can sing a score and its transcriber answers. */
  coverReady: boolean;
}
