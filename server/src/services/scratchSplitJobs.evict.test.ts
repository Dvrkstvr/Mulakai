import { describe, it, expect, vi } from 'vitest';
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
  downloadAudio: vi.fn(async () => Buffer.from('fake-stem-bytes')),
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { getRunning } = await import('./genQueue.js');
const {
  startScratchSplit, getScratchSplitJob, evictIdleScratchSplits, isLiveScratchDir, SCRATCH_IDLE_TTL_MS,
} = await import('./scratchSplitJobs.js');

async function settledSplit() {
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  const job = await startScratchSplit({ data: Buffer.from('a full song'), filename: 'song.wav' }, 'acestep');
  await vi.waitFor(() => expect(job.stems.every((s) => s.status === 'done')).toBe(true));
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return job;
}

describe('evictIdleScratchSplits', () => {
  it('discards a settled split unread for the TTL, temp folder and all', async () => {
    const job = await settledSplit();
    expect(isLiveScratchDir(job.outDir)).toBe(true);

    await evictIdleScratchSplits(job.lastSeenAt + SCRATCH_IDLE_TTL_MS + 1);

    expect(getScratchSplitJob(job.id)).toBeUndefined();
    expect(fs.existsSync(job.outDir)).toBe(false);
    expect(isLiveScratchDir(job.outDir)).toBe(false);
  });

  it('keeps a split whose stem was read recently, however long ago it started', async () => {
    const job = await settledSplit();
    const startedAt = job.lastSeenAt;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(startedAt + SCRATCH_IDLE_TTL_MS);
    getScratchSplitJob(job.id); // a stem preview, ANALYZE or GENERATE
    clock.mockRestore();

    await evictIdleScratchSplits(startedAt + SCRATCH_IDLE_TTL_MS + 1);

    expect(getScratchSplitJob(job.id)).toBe(job);
    expect(fs.existsSync(job.outDir)).toBe(true);
  });

  it('leaves a split alone while a stem is still running', async () => {
    const job = await settledSplit();
    job.stems[0].status = 'running';

    await evictIdleScratchSplits(job.lastSeenAt + 10 * SCRATCH_IDLE_TTL_MS);

    expect(getScratchSplitJob(job.id)).toBe(job);
  });
});
