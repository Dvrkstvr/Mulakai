/** What `GET /api/split/health` reports. `demucs` is the DEMUCS_API_URL slot (and the
 * `model` value that starts a split there); `demucsBackend` is which service answers in
 * it: demucs-server, or uvr-server (Roformer vocals). Null when the slot is unset or down. */
export interface SplitHealth {
  acestep: boolean;
  demucs: boolean;
  demucsBackend: 'demucs' | 'uvr' | null;
}

export const SPLIT_HEALTH_DOWN: SplitHealth = { acestep: false, demucs: false, demucsBackend: null };

/** The split-service tab's label. With nothing answering it keeps the slot's name. */
export function splitServiceLabel(health: SplitHealth): string {
  return health.demucsBackend === 'uvr' ? 'UVR' : 'DEMUCS';
}

export function splitServiceTitle(health: SplitHealth): string | undefined {
  if (!health.demucs) return 'no split service answers at DEMUCS_API_URL (demucs-server or uvr-server)';
  return health.demucsBackend === 'uvr' ? 'uvr-server: Roformer vocals, htdemucs for the rest' : 'demucs-server: htdemucs';
}
