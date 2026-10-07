/** The base grid cache (D-107): `${versionId}.grid.json` sidecars, `grid_v: 1`, read from the raw file. Temp DATA_DIR. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-gridcache-test-'));

const { config } = await import('../../config.js');
const { readGrid, writeGrid } = await import('./gridCache.js');
const { spliceContract } = await import('../../../test-fakes/fakeYue.js');

const GRID = spliceContract('splice-rerender').request.form.spec.base_grid as Record<string, unknown>;
fs.mkdirSync(config.audioDir, { recursive: true });
const file = (id: string) => path.join(config.audioDir, `${id}.grid.json`);

describe('gridCache', () => {
  it('writes a grid beside the version and reads it back', async () => {
    await writeGrid('v1', GRID);
    expect(JSON.parse(fs.readFileSync(file('v1'), 'utf8'))).toEqual(GRID);
    expect(await readGrid('v1')).toEqual(GRID);
  });

  it('no file, a file that is not JSON, or another grid_v reads as no cached grid (never a crash)', async () => {
    expect(await readGrid('missing')).toBeNull();
    fs.writeFileSync(file('bad'), '{not json');
    expect(await readGrid('bad')).toBeNull();
    fs.writeFileSync(file('v2'), JSON.stringify({ ...GRID, grid_v: 2 }));
    expect(await readGrid('v2')).toBeNull();
  });

  it('does not cache something that is not a grid_v 1 grid', async () => {
    expect(await writeGrid('x', { downbeats: [] })).toBe(false);
    expect(fs.existsSync(file('x'))).toBe(false);
  });
});
