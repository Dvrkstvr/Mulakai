/** Which stem-split backends can run right now, each reported on its own: Demucs never
 * touches ACE-Step, so one being down must not hide the other. */
import { config } from '../config.js';
import { listModels } from './acestep.js';

export interface SplitHealth {
  /** A downloaded model supports `extract`. Only meaningful when acestepError is null. */
  acestep: boolean;
  /** Why ACE-Step couldn't be asked (unreachable, timed out, non-2xx); null when it answered. */
  acestepError: string | null;
  /** The DEMUCS_API_URL slot answers (and `model: 'demucs'` starts a split there). */
  demucs: boolean;
  /** Why that slot is off: DEMUCS_API_URL unset, or set but not answering; null when it's up. */
  demucsReason: 'unset' | 'unreachable' | null;
  /** Which service answers in the slot: uvr-server or demucs-server; null when it's off. */
  demucsBackend: 'demucs' | 'uvr' | null;
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

async function demucsHealth(): Promise<Pick<SplitHealth, 'demucs' | 'demucsReason' | 'demucsBackend'>> {
  if (!config.demucsUrl) return { demucs: false, demucsReason: 'unset', demucsBackend: null };
  const res = await fetch(`${config.demucsUrl}/health`, { signal: AbortSignal.timeout(DEMUCS_PROBE_MS) }).catch(() => null);
  if (!res?.ok) return { demucs: false, demucsReason: 'unreachable', demucsBackend: null };
  // uvr-server sends `backend: "uvr"`; demucs-server sends no backend at all.
  const body = (await res.json().catch(() => null)) as { backend?: unknown } | null;
  return { demucs: true, demucsReason: null, demucsBackend: body?.backend === 'uvr' ? 'uvr' : 'demucs' };
}

export async function splitHealth(): Promise<SplitHealth> {
  const [acestep, demucs] = await Promise.all([acestepHealth(), demucsHealth()]);
  return { ...acestep, ...demucs };
}
