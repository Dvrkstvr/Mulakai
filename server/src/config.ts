import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3001),
  /** Bind address. Localhost-only by default — the API has no auth, so exposing it
   * (HOST=0.0.0.0) hands the whole library and the GPU to anyone on the LAN. */
  host: process.env.HOST ?? '127.0.0.1',
  acestepUrl: process.env.ACESTEP_API_URL ?? 'http://127.0.0.1:8001',
  acestepApiKey: process.env.ACESTEP_API_KEY ?? '',
  /** Empty = Demucs backend disabled (no separate stem-split microservice configured). */
  demucsUrl: process.env.DEMUCS_API_URL ?? '',
  /** Extra song-creation engines (PLAN.md "Multiple Song-Creation Engines"), in rollout
   * order. Empty URL = that engine is disabled; the key is an optional bearer token. */
  yueUrl: process.env.YUE_API_URL ?? '',
  yueApiKey: process.env.YUE_API_KEY ?? '',
  heartmulaUrl: process.env.HEARTMULA_API_URL ?? '',
  heartmulaApiKey: process.env.HEARTMULA_API_KEY ?? '',
  /** lyrics-server, for READ LYRICS (PLAN.md "Cover Lyrics From the Recording"). Empty = not set up. */
  lyricsUrl: process.env.LYRICS_API_URL ?? '',
  /** Ceiling on one synchronous /transcribe call: a warm job is seconds, the first one
   * downloads the model, and a hung call would otherwise hold the genLock forever. */
  lyricsTimeoutMs: Number(process.env.LYRICS_TIMEOUT_MS ?? 15 * 60_000),
  /** Largest READ LYRICS upload. A library WAV is float32 stereo, about 23 MB a minute. */
  lyricsMaxUploadMb: Number(process.env.LYRICS_MAX_UPLOAD_MB ?? 300),
  dataDir: process.env.DATA_DIR ?? path.resolve(__dirname, '../data'),
  get dbPath() {
    return path.join(this.dataDir, 'mulakai.db');
  },
  get audioDir() {
    return path.join(this.dataDir, 'audio');
  },
  /** How often the job orchestrator polls query_result (ms). */
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
  /** Per-request ceiling on ACE-Step HTTP calls (ms). Without one, a hung socket
   * (GPU wedge, dropped connection) stalls the poll loop forever and the global
   * generation lock is never released. Audio downloads get 5x this. */
  acestepTimeoutMs: Number(process.env.ACESTEP_TIMEOUT_MS ?? 60_000),
  /** Largest cover TRANSCRIBE upload. A library WAV is float32 stereo, about 23 MB a minute.
   * The source is forwarded to yue-server, whose YUE_MAX_UPLOAD_MB must be at least this. */
  coverMaxUploadMb: Number(process.env.COVER_MAX_UPLOAD_MB ?? 300),
};
