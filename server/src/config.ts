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
  /** The score planner (PLAN.md "Score Agent"): a local Ollama, reached through its
   * OpenAI-compatible /v1 and, to unload, its native /api (D-012). Empty = SCORE hidden. */
  llmUrl: (process.env.LLM_API_URL ?? '').trim().replace(/\/+$/, '').replace(/\/v1$/, ''),
  llmModel: process.env.LLM_MODEL || 'qwen3:14b',
  /** One planner call, cold load included (SP-2: 2.5 s for qwen3:14b, up to 50 s for a 26B MoE). */
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 180_000),
  /** lyrics-server, for READ LYRICS (PLAN.md "Cover Lyrics From the Recording"). Empty = not set up. */
  lyricsUrl: process.env.LYRICS_API_URL ?? '',
  /** Ceiling on one synchronous /transcribe call: a warm job is seconds, the first one
   * downloads the model, and a hung call would otherwise hold the queue's slot forever. */
  lyricsTimeoutMs: Number(process.env.LYRICS_TIMEOUT_MS ?? 15 * 60_000),
  /** Largest READ LYRICS upload. A library WAV is float32 stereo, about 23 MB a minute. */
  lyricsMaxUploadMb: Number(process.env.LYRICS_MAX_UPLOAD_MB ?? 300),
  dataDir: process.env.DATA_DIR ?? path.resolve(__dirname, '../data'),
  get dbPath() {
    return path.join(this.dataDir, 'mulakai.db');
  },
  /** AUDIO_DIR overrides it, so the audio can sit on a bind mount while the database stays
   * on local disk (SQLite must never be on a network filesystem). */
  get audioDir() {
    return process.env.AUDIO_DIR || path.join(this.dataDir, 'audio');
  },
  /** The built client to serve (clientStatic.ts). Empty = API only; Vite serves it in dev. */
  clientDist: process.env.CLIENT_DIST ?? '',
  /** How often the job orchestrator polls query_result (ms). */
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
  /** Per-request ceiling on ACE-Step HTTP calls (ms). Without one, a hung socket
   * (GPU wedge, dropped connection) stalls the poll loop forever and the global
   * queue's slot is never freed. Audio downloads get 5x this. */
  acestepTimeoutMs: Number(process.env.ACESTEP_TIMEOUT_MS ?? 60_000),
  /** Deadline for the LM drafting calls (create_sample, format_input) (ms). ACE-Step only
   * answers once the LM has finished writing, which can take 2-3 minutes, so 60s cut off
   * drafts that would have arrived. */
  acestepLmTimeoutMs: Number(process.env.ACESTEP_LM_TIMEOUT_MS ?? 180_000),
  /** After ABORT, how long the queue's slot may wait for the abandoned backend task to stop
   * (ms) before the next job starts anyway. ACE-Step has no cancel, so an aborted task runs on
   * until it finishes; starting the next job beside it could overrun a 16 GB card. */
  abortDrainMs: Number(process.env.ABORT_DRAIN_MS ?? 10 * 60_000),
  /** How long the model list, which a person is waiting on, waits for ACE-Step (ms). ACE-Step
   * answers nothing while it generates, so 60s is too short there. Node's fetch gives up waiting
   * for headers at 300s on its own (undici's headersTimeout), so a larger value has no effect. */
  acestepLookupTimeoutMs: Number(process.env.ACESTEP_LOOKUP_TIMEOUT_MS ?? 300_000),
  /** Largest cover TRANSCRIBE upload. A library WAV is float32 stereo, about 23 MB a minute.
   * The source is forwarded to yue-server, whose YUE_MAX_UPLOAD_MB must be at least this. */
  coverMaxUploadMb: Number(process.env.COVER_MAX_UPLOAD_MB ?? 300),
};
