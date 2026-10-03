/**
 * Deleting SPLIT stem files that no version claimed. A claimed stem's version row
 * points at its file, so every delete here checks `versions.audio_file` first —
 * the DB, not any in-memory job state, is what guards claimed audio (PLAN.md
 * "Abandoned Splits Leave No Stems Behind").
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';

/** `<jobId>-<kind>-<nonce>.<ext>` (stemRunners.ts), or the pre-nonce `<jobId>-<kind>.<ext>`.
 * No other audioDir writer produces this shape. Group 1 is the job id. */
const STEM_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(?:vocals|drums|bass|other)(?:-[0-9a-f]{8})?\.[a-z0-9]+$/;

/** Delete a stem file no version points at. A missing or in-use file (Windows EBUSY) is left be. */
export async function discardUnclaimedFile(file: string | undefined): Promise<void> {
  if (!file) return;
  const ref = db.prepare(`SELECT 1 FROM versions WHERE audio_file = ? LIMIT 1`).get(file);
  if (ref) return;
  await fs.rm(path.join(config.audioDir, file), { force: true }).catch(() => {});
}

/** Delete every stem file in audioDir that no version points at and whose split job is not
 * live — what a server restart, or a split abandoned before eviction existed, left behind.
 * Returns how many files were removed. */
export async function sweepOrphanStems(isLive: (jobId: string) => boolean): Promise<number> {
  const files = await fs.readdir(config.audioDir);
  const claimed = new Set(
    (db.prepare(`SELECT audio_file FROM versions`).all() as Array<{ audio_file: string }>).map((r) => r.audio_file),
  );
  const orphans = files.filter((f) => {
    const jobId = STEM_FILE.exec(f)?.[1];
    return jobId !== undefined && !isLive(jobId) && !claimed.has(f);
  });
  await Promise.all(orphans.map((f) => fs.rm(path.join(config.audioDir, f), { force: true }).catch(() => {})));
  return orphans.length;
}

/** Fail every stem still running: a split (or RE-EXTRACT) couldn't read its source when its
 * turn in the queue came, or left the queue without running. */
export function failRunning(stems: { status: string; error?: string }[], err: unknown): void {
  for (const stem of stems.filter((s) => s.status === 'running')) {
    stem.status = 'failed';
    stem.error = err instanceof Error ? err.message : String(err);
  }
}
