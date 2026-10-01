import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_ROOT } from './data-dir';

/** Runs older than this are certainly finished; younger ones may belong to a run in another worktree. */
const STALE_MS = 60 * 60 * 1000;

/**
 * Removes earlier runs' data dirs. A run can't remove its own: Playwright runs globalTeardown
 * before it stops the webServers, so the server still holds the SQLite file then (EBUSY on Windows).
 */
export default async function globalSetup(): Promise<void> {
  const current = process.env.MULAKAI_E2E_DATA_DIR;
  const entries = await fs.readdir(DATA_ROOT, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const dir = path.join(DATA_ROOT, entry.name);
    if (!entry.isDirectory() || dir === current) continue;
    const { mtimeMs } = await fs.stat(dir);
    if (Date.now() - mtimeMs > STALE_MS) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
