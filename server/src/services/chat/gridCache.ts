/**
 * The beat-grid cache (D-107, docs/decisions/0005): a splice fits the downbeats of the base version
 * with SheetSage2 (~17 s); the grid is kept as `${versionId}.grid.json` beside the version's audio
 * (versionFiles deletes it with the version), so the next splice on that version sends it instead of
 * tracking again. yue-server's grid shape (`splice_grid.validate_grid`): `grid_v: 1`, `source`
 * (`tracked` or `mapped`), `downbeats`, `chords`, `duration`. Read from the raw file: anything else
 * (no file, not JSON, another `grid_v`) is no cached grid, never a crash (versions-data.md).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { gridSidecarName } from '../versionFiles.js';

export type Grid = Record<string, unknown> & { grid_v: 1 };

const isGrid = (g: unknown): g is Grid => Boolean(g && typeof g === 'object' && (g as { grid_v?: unknown }).grid_v === 1
  && Array.isArray((g as { downbeats?: unknown }).downbeats));

export async function readGrid(versionId: string): Promise<Grid | null> {
  try {
    const g = JSON.parse(await fs.readFile(path.join(config.audioDir, gridSidecarName(versionId)), 'utf8')) as unknown;
    return isGrid(g) ? g : null;
  } catch {
    return null;
  }
}

/** True when written; a grid of another shape is not cached (yue-server tracks again next time). */
export async function writeGrid(versionId: string, grid: unknown): Promise<boolean> {
  if (!isGrid(grid)) return false;
  await fs.writeFile(path.join(config.audioDir, gridSidecarName(versionId)), JSON.stringify(grid), 'utf8');
  return true;
}
