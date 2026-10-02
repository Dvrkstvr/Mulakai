/**
 * Bounds every in-memory job registry and the OS-temp files their jobs own (PLAN.md
 * "Idle Jobs Leave Every Registry"). Each registry decides what "idle" means for its
 * own jobs; this module only runs them together and sweeps temp files a restart stranded.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evictIdleJobs, isLiveResultPath } from './jobRegistry.js';
import { evictIdleScratchSplits, isLiveScratchDir } from './scratchSplitJobs.js';
import { evictIdleSplits } from './stemSplit.js';

/** Other Mulakai servers on this machine (worktree copies, another data dir) share OS temp,
 * so only age can say an entry is nobody's — and a week is past every registry's TTL. */
export const STALE_TEMP_MS = 7 * 24 * 60 * 60 * 1000;

/** scratchSplitJobs.ts's per-job folders and remasterJobs.ts's undownloaded results. */
const TEMP_ENTRY = /^mulakai-(?:split-[0-9a-f-]{36}|remaster-[0-9a-f-]{36}\.[a-z0-9]+)$/;

export async function evictIdle(now = Date.now()): Promise<void> {
  await Promise.all([evictIdleJobs(now), evictIdleScratchSplits(now), evictIdleSplits(now)]);
}

/** Delete Mulakai temp entries older than STALE_TEMP_MS that no live job owns. Returns the count. */
export async function sweepStaleTemp(now = Date.now(), dir = os.tmpdir()): Promise<number> {
  const names = (await fs.readdir(dir)).filter((n) => TEMP_ENTRY.test(n));
  const stale: string[] = [];
  for (const name of names) {
    const full = path.join(dir, name);
    const stat = await fs.stat(full).catch(() => undefined);
    if (!stat || now - stat.mtimeMs <= STALE_TEMP_MS) continue;
    if (isLiveScratchDir(full) || isLiveResultPath(full)) continue;
    stale.push(full);
  }
  await Promise.all(stale.map((f) => fs.rm(f, { recursive: true, force: true }).catch(() => {})));
  return stale.length;
}
