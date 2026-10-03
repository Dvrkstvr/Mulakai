import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

// The master lands at outPath verbatim — encoding rules live in transcode.test.ts.
vi.mock('./transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outPath, master);
  },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

vi.mock('./acestep.js', () => ({
  releaseTask: vi.fn(async () => ({ task_id: 'task-1' })),
  queryResult: vi.fn(async () => [
    {
      task_id: 'task-1',
      status: 1 as const,
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('acestep-stem')),
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { getRunning } = await import('./genQueue.js');
const { startSplit, claimStem, getSplitJob, isLiveSplit, evictIdleSplits, SPLIT_IDLE_TTL_MS } = await import('./stemSplit.js');

function seedLayer(): string {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const sourceFile = `${crypto.randomUUID()}.flac`;
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Test Song')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file) VALUES (?, ?, ?)`).run(crypto.randomUUID(), layerId, sourceFile);
  fs.writeFileSync(path.join(config.audioDir, sourceFile), 'source audio');
  return layerId;
}

async function settledSplit() {
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  const job = await startSplit(seedLayer(), 'acestep');
  await vi.waitFor(() => expect(job.stems.every((s) => s.status === 'done')).toBe(true));
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return job;
}

const exists = (file: string | undefined) => fs.existsSync(path.join(config.audioDir, file!));

describe('evictIdleSplits', () => {
  it('cancels a split idle past the TTL, removing unclaimed stems and keeping the claimed one', async () => {
    const job = await settledSplit();
    claimStem(job.id, 'vocals', 'add-layer');
    const files = Object.fromEntries(job.stems.map((s) => [s.kind, s.audioFile]));

    await evictIdleSplits(job.lastSeenAt + SPLIT_IDLE_TTL_MS + 1);

    expect(isLiveSplit(job.id)).toBe(false);
    expect(exists(files.vocals)).toBe(true);
    for (const kind of ['drums', 'bass', 'other']) expect(exists(files[kind])).toBe(false);
  });

  it('keeps a split that is still being polled, however long ago it started', async () => {
    const job = await settledSplit();
    const startedAt = job.lastSeenAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(startedAt + SPLIT_IDLE_TTL_MS);
    getSplitJob(job.id); // the client's status poll, an hour in
    clock.mockRestore();

    await evictIdleSplits(startedAt + SPLIT_IDLE_TTL_MS + 1);

    expect(isLiveSplit(job.id)).toBe(true);
    for (const s of job.stems) expect(exists(s.audioFile)).toBe(true);
  });

  it('leaves a split touched within the TTL alone', async () => {
    const job = await settledSplit();

    await evictIdleSplits(job.lastSeenAt + SPLIT_IDLE_TTL_MS);

    expect(isLiveSplit(job.id)).toBe(true);
  });
});
