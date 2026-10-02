import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('./jobRegistry.js', () => ({ evictIdleJobs: vi.fn(async () => {}), isLiveResultPath: vi.fn(() => false) }));
vi.mock('./scratchSplitJobs.js', () => ({ evictIdleScratchSplits: vi.fn(async () => {}), isLiveScratchDir: vi.fn(() => false) }));
vi.mock('./stemSplit.js', () => ({ evictIdleSplits: vi.fn(async () => {}) }));

const registry = await import('./jobRegistry.js');
const scratch = await import('./scratchSplitJobs.js');
const stemSplit = await import('./stemSplit.js');
const { evictIdle, sweepStaleTemp, STALE_TEMP_MS } = await import('./jobEviction.js');

const DAY = 24 * 60 * 60 * 1000;
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
  vi.mocked(registry.isLiveResultPath).mockReturnValue(false);
  vi.mocked(scratch.isLiveScratchDir).mockReturnValue(false);
});

/** A temp entry as scratchSplitJobs.ts / remasterJobs.ts name it, last modified `ageMs` ago. */
function entry(name: string, ageMs: number, folder = false): string {
  const full = path.join(dir, name);
  if (folder) {
    fs.mkdirSync(full);
    fs.writeFileSync(path.join(full, 'vocals.flac'), 'stem');
  } else {
    fs.writeFileSync(full, 'remaster');
  }
  const t = (Date.now() - ageMs) / 1000;
  fs.utimesSync(full, t, t);
  return full;
}

describe('evictIdle', () => {
  it('runs every registry\'s eviction at the same moment', async () => {
    await evictIdle(1234);
    expect(registry.evictIdleJobs).toHaveBeenCalledWith(1234);
    expect(scratch.evictIdleScratchSplits).toHaveBeenCalledWith(1234);
    expect(stemSplit.evictIdleSplits).toHaveBeenCalledWith(1234);
  });
});

describe('sweepStaleTemp', () => {
  it('removes split folders and remaster files older than a week', async () => {
    const split = entry(`mulakai-split-${crypto.randomUUID()}`, STALE_TEMP_MS + DAY, true);
    const remaster = entry(`mulakai-remaster-${crypto.randomUUID()}.flac`, STALE_TEMP_MS + DAY);

    expect(await sweepStaleTemp(Date.now(), dir)).toBe(2);
    expect(fs.existsSync(split)).toBe(false);
    expect(fs.existsSync(remaster)).toBe(false);
  });

  it('keeps younger entries, which another Mulakai server on this machine may own', async () => {
    const split = entry(`mulakai-split-${crypto.randomUUID()}`, DAY, true);
    const remaster = entry(`mulakai-remaster-${crypto.randomUUID()}.wav`, DAY);

    expect(await sweepStaleTemp(Date.now(), dir)).toBe(0);
    expect(fs.existsSync(split)).toBe(true);
    expect(fs.existsSync(remaster)).toBe(true);
  });

  it('keeps old entries a live job still owns', async () => {
    const split = entry(`mulakai-split-${crypto.randomUUID()}`, STALE_TEMP_MS + DAY, true);
    const remaster = entry(`mulakai-remaster-${crypto.randomUUID()}.mp3`, STALE_TEMP_MS + DAY);
    vi.mocked(scratch.isLiveScratchDir).mockImplementation((p) => p === split);
    vi.mocked(registry.isLiveResultPath).mockImplementation((p) => p === remaster);

    expect(await sweepStaleTemp(Date.now(), dir)).toBe(0);
    expect(fs.existsSync(split)).toBe(true);
    expect(fs.existsSync(remaster)).toBe(true);
  });

  it('never touches other old temp entries, test data dirs included', async () => {
    const others = [
      entry('mulakai-test-abc123', STALE_TEMP_MS + DAY, true),
      entry('mulakai-split-notauuid', STALE_TEMP_MS + DAY, true),
      entry(`someone-else-${crypto.randomUUID()}.flac`, STALE_TEMP_MS + DAY),
    ];

    expect(await sweepStaleTemp(Date.now(), dir)).toBe(0);
    for (const f of others) expect(fs.existsSync(f)).toBe(true);
  });
});
