import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

const releaseTask = vi.fn(async () => ({ task_id: 'task-1' }));
const defaultQueryResult = async () => [
  {
    task_id: 'task-1',
    status: 1 as const,
    result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '' }],
  },
];
const queryResult = vi.fn(defaultQueryResult);
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
  queryResult: (...args: unknown[]) => queryResult(...args),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: vi.fn(() => 'wav'),
  // resolveInferenceSteps() consults the inventory to fill STEPS AUTO; an empty one
  // keeps ACE-Step's own legacy default, so these tests' params are unaffected.
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
  initModel: (...args: unknown[]) => initModel(...args),
}));

const initModel = vi.fn(async (..._args: unknown[]) => { callOrder.push('initModel'); });
const reconcileAdapter = vi.fn(async () => { callOrder.push('reconcileAdapter'); });
const callOrder: string[] = [];

vi.mock('./adapters.js', () => ({ reconcileAdapter: () => reconcileAdapter() }));

const { db } = await import('../db/index.js');
const { getJob } = await import('./jobs.js');
const jobsModule = await import('./jobs.js');
const { startGeneration, abortJob } = jobsModule;

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    const job = getJob(jobId);
    if (job?.status === 'failed') throw new Error(`job failed: ${job.error}`);
    expect(job?.status).toBe('done');
  });
}

describe('startGeneration with an ad-hoc reference-audio upload', () => {
  it('sends the uploaded file as reference_audio and remaps audio_influence/style_influence, same as a saved voice', async () => {
    releaseTask.mockClear();
    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'My Song', {
      referenceAudioFile: { data: Buffer.from('ref-bytes'), filename: 'ref.wav' },
      audioInfluence: 0.8,
      styleInfluence: 0.3,
    });
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params, opts] = releaseTask.mock.calls[0] as [Record<string, unknown>, { referenceAudio: { data: Buffer } }];
    expect(opts.referenceAudio.data.toString()).toBe('ref-bytes');
    expect(params.audio_cover_strength).toBe(0.8); // applyVoiceInfluence's audio_influence -> audio_cover_strength mapping
  });

  it('works without any voice/reference option at all', async () => {
    releaseTask.mockClear();
    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'My Song');
    await waitForDone(job.id);

    const [, opts] = releaseTask.mock.calls[0] as [Record<string, unknown>, { referenceAudio?: unknown } | undefined];
    expect(opts?.referenceAudio).toBeUndefined();
  });

  it('persists the reference-audio label + influences onto the song for the library rail', async () => {
    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'Ref Meta Song', {
      referenceAudioFile: { data: Buffer.from('ref-bytes'), filename: 'my-clip.wav' },
      audioInfluence: 0.8,
      styleInfluence: 0.3,
    });
    await waitForDone(job.id);

    const row = db.prepare(
      `SELECT reference_audio_label AS label, reference_audio_influence AS a, reference_style_influence AS s
         FROM songs WHERE title = ?`,
    ).get('Ref Meta Song') as { label: string; a: number; s: number };
    expect(row).toMatchObject({ label: 'my-clip.wav', a: 0.8, s: 0.3 });
  });

  it('leaves the reference-audio columns null when no reference was used', async () => {
    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'No Ref Song');
    await waitForDone(job.id);

    const row = db.prepare(
      `SELECT reference_audio_label AS label FROM songs WHERE title = ?`,
    ).get('No Ref Song') as { label: string | null };
    expect(row.label).toBeNull();
  });

  it('records the generating task on the song so REUSE PROMPT can reopen the right tab', async () => {
    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'Task Song');
    await waitForDone(job.id);

    const row = db.prepare(`SELECT gen_task FROM songs WHERE title = ?`).get('Task Song') as { gen_task: string };
    expect(row.gen_task).toBe('text2music');
  });
});

describe('startGeneration abort race (the exact bug: create-view GENERATE, then header ABORT)', () => {
  it('does not persist a song if aborted while ACE-Step was still accepting the submission', async () => {
    releaseTask.mockClear();
    let job: ReturnType<typeof startGeneration>;
    // Simulates the header's ABORT firing mid-submission: startGeneration registers the Job
    // synchronously (before any await), so by the time releaseTask is invoked, abortJob can
    // find and mark it — this used to be a silent no-op for repaint/addLayer/remaster (fixed
    // alongside this), but startGeneration itself always registered early; this test locks
    // in that the wasAborted() checks actually stop the flow before persistSong runs.
    releaseTask.mockImplementationOnce(async () => {
      abortJob(job.id);
      return { task_id: 'task-1' };
    });

    job = startGeneration({ prompt: 'a driving synthwave track' }, 'Abort Race Song');

    await vi.waitFor(() => {
      expect(getJob(job.id)?.status).toBe('failed');
    });
    expect(getJob(job.id)?.error).toBe('Aborted');

    // give any errant poll()/persistSong a moment to run — there should be none
    await new Promise((r) => setTimeout(r, 30));
    const row = db.prepare(`SELECT COUNT(*) as c FROM songs WHERE title = ?`).get('Abort Race Song') as { c: number };
    expect(row.c).toBe(0);
  });
});

describe('poll() progress passthrough', () => {
  it('copies progress/stage/progress_text onto the job while still running, then clears the way for the done result', async () => {
    releaseTask.mockClear();
    queryResult.mockReset();
    queryResult
      .mockImplementationOnce(async () => [
        { task_id: 'task-1', status: 0 as const, result: [{ file: '', status: 0 as const, prompt: '', lyrics: '', metas: {}, seed_value: '', progress: 0.42, stage: 'sampling' }], progress_text: 'step 12/50' },
      ])
      .mockImplementation(async () => [
        { task_id: 'task-1', status: 1 as const, result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '' }] },
      ]);

    const job = startGeneration({ prompt: 'a driving synthwave track' }, 'Progress Song');

    await vi.waitFor(() => {
      expect(getJob(job.id)?.progress).toBe(0.42);
    });
    expect(getJob(job.id)?.progressStage).toBe('sampling');
    expect(getJob(job.id)?.progressText).toBe('step 12/50');

    await waitForDone(job.id);
    // queryResult mock is shared across this file's tests — restore the steady default.
    queryResult.mockReset();
    queryResult.mockImplementation(defaultQueryResult);
  });
});

describe('abortJob', () => {
  it('marks a running job failed and releases the gen lock so the header can force-unblock it', async () => {
    const { registerJob, abortJob, getJob } = jobsModule;
    const { acquireGenLock, getGenLock } = await import('./genLock.js');
    acquireGenLock({ kind: 'generate', jobId: 'abort-1' });
    registerJob({ id: 'abort-1', taskId: 't', status: 'running', createdAt: Date.now() });

    expect(abortJob('abort-1')).toBe(true);

    expect(getJob('abort-1')?.status).toBe('failed');
    expect(getJob('abort-1')?.error).toBe('Aborted');
    expect(getGenLock()).toBeNull();
  });

  it('is a no-op for an unknown job id', () => {
    expect(jobsModule.abortJob('does-not-exist')).toBe(false);
  });

  it('does not resurface a result for a job that already finished', async () => {
    const { registerJob, abortJob, getJob } = jobsModule;
    registerJob({ id: 'abort-2', taskId: 't', status: 'done', songId: 's1', createdAt: Date.now() });

    expect(abortJob('abort-2')).toBe(false);
    expect(getJob('abort-2')?.status).toBe('done');
  });
});

describe('ensureModelLoaded', () => {
  beforeEach(() => {
    callOrder.length = 0;
    initModel.mockClear();
    reconcileAdapter.mockClear();
  });

  it('reconciles the adapter selection after the init that drops it', async () => {
    // /v1/init rebuilds the DiT and detaches any loaded adapter, so reconciling before it
    // would apply the adapter to a model that is about to be thrown away.
    await jobsModule.ensureModelLoaded({ task_type: 'text2music', model: 'acestep-v15-base' });

    expect(callOrder).toEqual(['initModel', 'reconcileAdapter']);
  });

  it('still reconciles when no model was selected and no init runs', async () => {
    await jobsModule.ensureModelLoaded({ task_type: 'text2music' });

    expect(initModel).not.toHaveBeenCalled();
    expect(reconcileAdapter).toHaveBeenCalledTimes(1);
  });

  it('fails the job when the adapter cannot be applied, rather than silently using the base model', async () => {
    reconcileAdapter.mockRejectedValueOnce(new Error('ACE-Step /v1/lora/load -> Failed to load LoRA'));

    await expect(jobsModule.ensureModelLoaded({ task_type: 'text2music' })).rejects.toThrow('Failed to load LoRA');
  });
});
