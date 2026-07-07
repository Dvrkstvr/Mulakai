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
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: vi.fn(() => 'wav'),
}));

const { getJob } = await import('./jobs.js');
const jobsModule = await import('./jobs.js');
const { startGeneration } = jobsModule;

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
});
