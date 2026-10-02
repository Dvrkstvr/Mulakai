/** How the split pickers name and explain the two backends in `GET /api/split/health`.
 * `demucs` is the DEMUCS_API_URL slot (and the `model` value that starts a split there);
 * `demucsBackend` says which service answers in it, so the tab can read UVR or DEMUCS. */
import type { SplitHealth } from './api';

/** The split-service tab's label. With nothing answering it keeps the slot's name. */
export function splitServiceLabel(health: SplitHealth): string {
  return health.demucsBackend === 'uvr' ? 'UVR' : 'DEMUCS';
}

/** A backend tab's title: what runs there when it's up, which "can't" the server reported when it's off. */
export function splitBackendTitle(health: SplitHealth, backend: 'acestep' | 'demucs'): string | undefined {
  if (backend === 'acestep') {
    if (health.acestep) return undefined;
    return health.acestepError ? "couldn't check ACE-Step" : 'no downloaded model supports extract — requires a Base model';
  }
  if (health.demucs) {
    return health.demucsBackend === 'uvr' ? 'uvr-server: Roformer vocals, htdemucs for the rest' : 'demucs-server: htdemucs';
  }
  return health.demucsReason === 'unreachable'
    ? 'no split service answers at DEMUCS_API_URL (demucs-server or uvr-server)'
    : 'no split service configured (DEMUCS_API_URL unset)';
}
