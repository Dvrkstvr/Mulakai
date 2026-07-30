import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

// Encoding is not what these tests are about — they feed synthetic bytes that a
// real ffmpeg would reject. transcodeBuffer's job here is just "the master ends
// up at outPath"; the arg/format rules are asserted in transcode.test.ts.
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
  // resolveInferenceSteps() consults the inventory to fill STEPS AUTO; an empty one
  // keeps ACE-Step's own legacy default, so these tests' params are unaffected.
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { startScratchSplit, getScratchSplitJob, discardScratchSplit, scratchStemPath } = await import('./scratchSplitJobs.js');

async function runToCompletion(model: 'acestep' | 'demucs' = 'acestep') {
  const job = await startScratchSplit({ data: Buffer.from('a full song'), filename: 'song.wav' }, model);
  await vi.waitFor(() => {
    const current = getScratchSplitJob(job.id);
    expect(current?.stems.every((s) => s.status === 'done')).toBe(true);
  });
  return job;
}

describe('startScratchSplit', () => {
  it('produces all four stems without touching the songs/layers tables', async () => {
    const job = await runToCompletion();
    expect(job.stems.map((s) => s.kind).sort()).toEqual(['bass', 'drums', 'other', 'vocals']);
    for (const stem of job.stems) {
      expect(scratchStemPath(job, stem.kind)).toBeTruthy();
      expect(fs.existsSync(scratchStemPath(job, stem.kind)!)).toBe(true);
    }
  });

  it('writes stems to a scratch dir outside config.audioDir', async () => {
    const { config } = await import('../config.js');
    const job = await runToCompletion();
    expect(job.outDir.startsWith(config.audioDir)).toBe(false);
  });

  it('discardScratchSplit removes the job and its temp files', async () => {
    const job = await runToCompletion();
    const filePath = scratchStemPath(job, 'vocals')!;
    expect(fs.existsSync(filePath)).toBe(true);

    await discardScratchSplit(job.id);

    expect(getScratchSplitJob(job.id)).toBeUndefined();
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
