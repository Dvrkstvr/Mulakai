import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

const releaseTask = vi.fn(async () => ({ task_id: 'task-1' }));
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
  releaseTask: (...args: unknown[]) => releaseTask(...args),
  queryResult: vi.fn(async () => [
    {
      task_id: 'task-1',
      status: 1 as const,
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: 'add a full band', lyrics: '', metas: {}, seed_value: 'seed' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: vi.fn(() => 'wav'),
  // resolveInferenceSteps() consults the inventory to fill STEPS AUTO; an empty one
  // keeps ACE-Step's own legacy default, so these tests' params are unaffected.
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', async () => {
  const actual = await vi.importActual<typeof import('./jobs.js')>('./jobs.js');
  return { ...actual, ensureModelLoaded: vi.fn(async () => {}) };
});

const { db } = await import('../db/index.js');
const { getJob, abortJob } = await import('./jobs.js');
const { startCompleteGeneration } = await import('./completeGenJobs.js');

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    const job = getJob(jobId);
    if (job?.status === 'failed') throw new Error(`job failed: ${job.error}`);
    expect(job?.status).toBe('done');
  });
}

describe('startCompleteGeneration', () => {
  it('sends a complete task with the source track and optional reference audio', async () => {
    releaseTask.mockClear();
    const job = startCompleteGeneration(
      { data: Buffer.from('vocals'), filename: 'vocals.wav' },
      'My Complete',
      { prompt: 'add a full band', model: 'acestep-v15-xl-base' },
      { data: Buffer.from('ref'), filename: 'ref.wav' },
    );
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params, opts] = releaseTask.mock.calls[0] as [
      Record<string, unknown>,
      { srcAudio: { data: Buffer; filename: string }; referenceAudio?: { data: Buffer; filename: string } },
    ];
    expect(params.task_type).toBe('complete');
    expect(params.model).toBe('acestep-v15-xl-base');
    expect(opts.srcAudio.data.toString()).toBe('vocals');
    expect(opts.referenceAudio?.data.toString()).toBe('ref');
  });

  it('works without a reference audio file', async () => {
    releaseTask.mockClear();
    const job = startCompleteGeneration(
      { data: Buffer.from('vocals'), filename: 'vocals.wav' },
      'My Complete',
      { prompt: 'add a full band', model: 'acestep-v15-xl-base' },
    );
    await waitForDone(job.id);

    const [, opts] = releaseTask.mock.calls[0] as [Record<string, unknown>, { referenceAudio?: unknown }];
    expect(opts.referenceAudio).toBeUndefined();
  });

  it('persists the result as a brand-new song', async () => {
    const before = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };

    const job = startCompleteGeneration(
      { data: Buffer.from('vocals'), filename: 'vocals.wav' },
      'My Complete',
      { prompt: 'add a full band', model: 'acestep-v15-xl-base' },
    );
    await waitForDone(job.id);

    const after = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };
    expect(after.c).toBe(before.c + 1);
    expect(getJob(job.id)?.songId).toBeTruthy();
    // Recorded so the Library's REUSE PROMPT reopens Create's ARRANGE tab, not PROMPT.
    const song = db.prepare(`SELECT gen_task FROM songs WHERE id = ?`).get(getJob(job.id)?.songId) as { gen_task: string };
    expect(song.gen_task).toBe('complete');
  });

  it('does not persist a song if aborted while ACE-Step was still accepting the submission', async () => {
    releaseTask.mockClear();
    const before = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };
    let job: ReturnType<typeof startCompleteGeneration>;
    releaseTask.mockImplementationOnce(async () => {
      abortJob(job.id);
      return { task_id: 'task-1' };
    });

    job = startCompleteGeneration(
      { data: Buffer.from('vocals'), filename: 'vocals.wav' },
      'My Complete',
      { prompt: 'add a full band', model: 'acestep-v15-xl-base' },
    );

    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('failed'));
    expect(getJob(job.id)?.error).toBe('Aborted');
    await new Promise((r) => setTimeout(r, 30));
    const after = db.prepare(`SELECT COUNT(*) as c FROM songs`).get() as { c: number };
    expect(after.c).toBe(before.c);
  });
});
