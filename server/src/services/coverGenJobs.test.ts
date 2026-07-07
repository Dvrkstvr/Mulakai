import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

const releaseTask = vi.fn(async () => ({ task_id: 'task-1' }));
vi.mock('./acestep.js', () => ({
  releaseTask: (...args: unknown[]) => releaseTask(...args),
  queryResult: vi.fn(async () => [
    {
      task_id: 'task-1',
      status: 1 as const,
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: 'a cover', lyrics: '', metas: {}, seed_value: 'seed' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: vi.fn(() => 'wav'),
}));
vi.mock('./jobs.js', async () => {
  const actual = await vi.importActual<typeof import('./jobs.js')>('./jobs.js');
  return { ...actual, ensureModelLoaded: vi.fn(async () => {}) };
});

const { db } = await import('../db/index.js');
const { getJob } = await import('./jobs.js');
const { startCoverGeneration } = await import('./coverGenJobs.js');

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    const job = getJob(jobId);
    if (job?.status === 'failed') throw new Error(`job failed: ${job.error}`);
    expect(job?.status).toBe('done');
  });
}

describe('startCoverGeneration', () => {
  it('sends a cover task with the provided source audio and params', async () => {
    releaseTask.mockClear();
    const job = startCoverGeneration(Buffer.from('source'), 'My Cover', { prompt: 'a driving synthwave track', model: 'acestep-v15-xl-sft' });
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params, opts] = releaseTask.mock.calls[0] as [Record<string, unknown>, { srcAudio: { data: Buffer; filename: string } }];
    expect(params.task_type).toBe('cover');
    expect(params.model).toBe('acestep-v15-xl-sft');
    expect(params.prompt).toBe('a driving synthwave track');
    expect(opts.srcAudio.data.toString()).toBe('source');
  });

  it('persists the result as a brand-new song, not a version on an existing one', async () => {
    const before = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };

    const job = startCoverGeneration(Buffer.from('source'), 'My Cover', { prompt: 'a driving synthwave track', model: 'acestep-v15-xl-sft' });
    await waitForDone(job.id);

    const after = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };
    expect(after.c).toBe(before.c + 1);
    expect(getJob(job.id)?.songId).toBeTruthy();
  });
});
