/**
 * The engine list the client sees: ACE-Step (built in — it contributes a descriptor and
 * its health check, while its job flow stays in jobs.ts) followed by each extra engine.
 */
import { health as acestepHealth } from '../acestep.js';
import { health as engineHealth } from '../engineClient.js';
import type { EngineCapabilities, EngineId, SongEngine } from './types.js';
import { yue2Engine } from './yue2.js';

/** Extra engines in rollout order: YuE2, then HeartMuLa (feat/heartmula-engine). An
 * engine whose URL is unset is listed as not configured and never probed. */
export const EXTRA_ENGINES: readonly SongEngine[] = [yue2Engine];

export const ACESTEP_CAPABILITIES: EngineCapabilities = {
  duration: 'exact',
  musicalMeta: 'params',
  referenceAudio: true,
  adapters: true,
  seed: true,
  languages: 'any',
  sectionTags: null,
  lmTools: true,
  advanced: true,
  takes: true,
  extraControls: [],
  // The default engine keeps today's PROMPT tab, which states no engine line.
  consequence: '',
};

export interface EngineInfo {
  id: EngineId | 'acestep';
  label: string;
  capabilities: EngineCapabilities;
  configured: boolean;
  ready: boolean;
}

export function getEngine(id: string, engines: readonly SongEngine[] = EXTRA_ENGINES): SongEngine | undefined {
  return engines.find((e) => e.id === id);
}

/** Every engine with live health, probed in parallel. An unconfigured engine is never
 * probed — it isn't ready by definition. */
export async function listEngines(engines: readonly SongEngine[] = EXTRA_ENGINES): Promise<EngineInfo[]> {
  const [acestepReady, ...extraReady] = await Promise.all([
    acestepHealth(),
    ...engines.map((e) => (e.url ? engineHealth(e) : Promise.resolve(false))),
  ]);
  return [
    { id: 'acestep', label: 'ACE-STEP', capabilities: ACESTEP_CAPABILITIES, configured: true, ready: acestepReady },
    ...engines.map((e, i) => ({
      id: e.id, label: e.label, capabilities: e.capabilities, configured: !!e.url, ready: extraReady[i],
    })),
  ];
}
