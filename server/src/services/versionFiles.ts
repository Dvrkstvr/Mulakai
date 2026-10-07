/**
 * A version's files inside audioDir: its audio, plus an optional `${versionId}.abc`
 * score sidecar that an extra engine may return (YuE2's plan — see PLAN.md "Framework
 * decisions"), and an optional `${versionId}.grid.json` beat grid (the chat's splice,
 * chat/gridCache.ts). Every path that deletes a version's audio goes through here so no
 * sidecar outlives it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export function scoreSidecarName(versionId: string): string {
  return `${versionId}.abc`;
}

export async function writeScoreSidecar(versionId: string, score: string): Promise<void> {
  await fs.writeFile(path.join(config.audioDir, scoreSidecarName(versionId)), score, 'utf8');
}

/** The beat grid a splice fitted on this version (grid_v 1), cached for the next splice. */
export function gridSidecarName(versionId: string): string {
  return `${versionId}.grid.json`;
}

/** Every file a version may own, sidecars included whether or not they exist. */
export function versionFileNames(version: { id: string; audio_file: string }): string[] {
  return [version.audio_file, scoreSidecarName(version.id), gridSidecarName(version.id)];
}

/** Best-effort removal: a missing file is fine, and an in-use one (Windows EBUSY while
 * the player still streams it) must not surface as an unhandled rejection. */
export async function removeVersionFiles(version: { id: string; audio_file: string }): Promise<void> {
  await Promise.all(
    versionFileNames(version).map((f) => fs.rm(path.join(config.audioDir, f), { force: true }).catch(() => {})),
  );
}
