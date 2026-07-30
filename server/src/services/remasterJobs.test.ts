import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
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
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: 'seed' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  // resolveInferenceSteps() consults the inventory to fill STEPS AUTO; an empty one
  // keeps ACE-Step's own legacy default, so these tests' params are unaffected.
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', async () => {
  const actual = await vi.importActual<typeof import('./jobs.js')>('./jobs.js');
  return { ...actual, ensureModelLoaded: vi.fn(async () => {}) };
});

const { db } = await import('../db/index.js');
const { getJob, getActiveGeneration, abortJob } = await import('./jobs.js');
const { startRemaster } = await import('./remasterJobs.js');

function seedSong(): string {
  const songId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(songId, 'Test Song', 'a driving synthwave track', '[Verse]\nneon lights', 128, 'A minor', '4');
  return songId;
}

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    expect(getJob(jobId)?.status).toBe('done');
  });
}

describe('startRemaster', () => {
  it('rejects an unknown song', async () => {
    await expect(startRemaster(crypto.randomUUID(), Buffer.from('x'), 'acestep-v15-xl-sft')).rejects.toThrow('unknown song');
  });

  it('sends a cover task at 100 steps with the song\'s own metadata and no cover-strength/guidance override', async () => {
    releaseTask.mockClear();
    const songId = seedSong();

    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft');
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    expect(params.task_type).toBe('cover');
    expect(params.model).toBe('acestep-v15-xl-sft');
    expect(params.inference_steps).toBe(100);
    expect(params.prompt).toBe('a driving synthwave track');
    expect(params.lyrics).toBe('[Verse]\nneon lights');
    expect(params.bpm).toBe(128);
    expect(params.key_scale).toBe('A minor');
    expect(params.time_signature).toBe('4');
    expect(params.audio_cover_strength).toBeUndefined();
    expect(params.guidance_scale).toBeUndefined();
  });

  it('caps steps at 200 and always renders the lossless master', async () => {
    releaseTask.mockClear();
    const songId = seedSong();

    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft', {
      output: { format: 'flac', bitDepth: 24, sampleRate: 48000, mp3Bitrate: 320 }, steps: 999,
    });
    await waitForDone(job.id);

    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    // The chosen container is applied by transcode.ts on the way to disk, never
    // asked of ACE-Step — so the wire format is the master regardless.
    expect(params.audio_format).toBe('wav32');
    expect(params.inference_steps).toBe(200);
  });

  it('names the scratch result after the chosen container, not the master', async () => {
    const songId = seedSong();
    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft', {
      output: { format: 'mp3', bitDepth: 24, sampleRate: 44100, mp3Bitrate: 320 }, steps: 10,
    });
    await waitForDone(job.id);
    expect(job.resultPath?.endsWith('.mp3')).toBe(true);
  });

  it('never writes a layer or version row for the result', async () => {
    const songId = seedSong();
    const before = db.prepare(`SELECT COUNT(*) as c FROM versions`).get() as { c: number };

    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft');
    await waitForDone(job.id);

    const after = db.prepare(`SELECT COUNT(*) as c FROM versions`).get() as { c: number };
    expect(after.c).toBe(before.c);
  });

  it('sets resultPath on the job to a scratch file outside audioDir once done', async () => {
    const songId = seedSong();

    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft');
    await waitForDone(job.id);

    const done = getJob(job.id);
    expect(done?.resultPath).toBeTruthy();
    expect(fs.existsSync(done!.resultPath!)).toBe(true);
  });

  it('does not produce a resultPath if aborted while ACE-Step was still accepting the submission', async () => {
    releaseTask.mockClear();
    const songId = seedSong();
    releaseTask.mockImplementationOnce(async () => {
      const { lock } = getActiveGeneration();
      if (lock) abortJob(lock.jobId);
      return { task_id: 'task-1' };
    });

    const job = await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-xl-sft');

    expect(job.status).toBe('failed');
    expect(job.error).toBe('Aborted');
    await new Promise((r) => setTimeout(r, 30));
    expect(getJob(job.id)?.resultPath).toBeUndefined();
  });
});
