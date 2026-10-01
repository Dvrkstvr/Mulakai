/** Which stem-split backends can run right now, each reported on its own: Demucs never
 * touches ACE-Step, so one being down must not hide the other. */
import { config } from '../config.js';
import { listModels } from './acestep.js';

export interface SplitHealth {
  /** A downloaded model supports `extract`. Only meaningful when acestepError is null. */
  acestep: boolean;
  /** Why ACE-Step couldn't be asked (unreachable, timed out, non-2xx); null when it answered. */
  acestepError: string | null;
  demucs: boolean;
  /** Why Demucs is off: DEMUCS_API_URL unset, or set but not answering; null when it's up. */
  demucsReason: 'unset' | 'unreachable' | null;
}

// Same leash as acestep.health(): a hung probe is as bad as a down one.
const DEMUCS_PROBE_MS = 10_000;

async function acestepHealth(): Promise<Pick<SplitHealth, 'acestep' | 'acestepError'>> {
  try {
    const { models } = await listModels();
    return { acestep: models.some((m) => m.supportedTaskTypes.includes('extract')), acestepError: null };
  } catch (err) {
    return { acestep: false, acestepError: err instanceof Error ? err.message : String(err) };
  }
}

async function demucsHealth(): Promise<Pick<SplitHealth, 'demucs' | 'demucsReason'>> {
  if (!config.demucsUrl) return { demucs: false, demucsReason: 'unset' };
  const ok = await fetch(`${config.demucsUrl}/health`, { signal: AbortSignal.timeout(DEMUCS_PROBE_MS) })
    .then((r) => r.ok, () => false);
  return ok ? { demucs: true, demucsReason: null } : { demucs: false, demucsReason: 'unreachable' };
}

export async function splitHealth(): Promise<SplitHealth> {
  const [acestep, demucs] = await Promise.all([acestepHealth(), demucsHealth()]);
  return { ...acestep, ...demucs };
}
