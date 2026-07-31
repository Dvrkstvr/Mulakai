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
  dataDir: process.env.DATA_DIR ?? path.resolve(__dirname, '../data'),
  get dbPath() {
    return path.join(this.dataDir, 'mulakai.db');
  },
  get audioDir() {
    return path.join(this.dataDir, 'audio');
  },
  /** How often the job orchestrator polls query_result (ms). */
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
};
