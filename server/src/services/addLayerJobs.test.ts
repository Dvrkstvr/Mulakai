import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
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
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: 'seed' }],
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
const { getJob, getActiveGeneration, abortJob } = await import('./jobs.js');
const { startAddLayer } = await import('./addLayerJobs.js');

function seedSong(): string {
  const songId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(songId, 'Test Song');
  return songId;
}

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    expect(getJob(jobId)?.status).toBe('done');
  });
}

describe('startAddLayer', () => {
  it('rejects an unknown song', async () => {
    await expect(
      startAddLayer(crypto.randomUUID(), 'add strings', 'Strings', Buffer.from('mix'), {}),
    ).rejects.toThrow('unknown song');
  });

  it('sends a lego task spanning the full mix and persists a new layer', async () => {
    releaseTask.mockClear();
    const songId = seedSong();

    const job = await startAddLayer(songId, 'add strings', 'Strings', Buffer.from('mix'), {});
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    expect(params.task_type).toBe('lego');
    expect(params.prompt).toBe('add strings');
    expect(params.repainting_start).toBe(0);
    expect(params.repainting_end).toBe(-1);

    const layer = db.prepare(`SELECT name, kind FROM layers WHERE song_id = ? AND kind = 'instrument'`).get(songId) as
      { name: string; kind: string } | undefined;
    expect(layer?.name).toBe('Strings');
  });

  it('forwards optional lyrics into the lego task', async () => {
    releaseTask.mockClear();
    const songId = seedSong();

    const job = await startAddLayer(songId, 'gospel choir', 'Choir', Buffer.from('mix'), { lyrics: 'hallelujah' });
    await waitForDone(job.id);

    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    expect(params.lyrics).toBe('hallelujah');
  });

  it('does not persist a layer if aborted while ACE-Step was still accepting the submission', async () => {
    releaseTask.mockClear();
    const songId = seedSong();
    releaseTask.mockImplementationOnce(async () => {
      const { lock } = getActiveGeneration();
      if (lock) abortJob(lock.jobId);
      return { task_id: 'task-1' };
    });

    const job = await startAddLayer(songId, 'add strings', 'Strings', Buffer.from('mix'), {});

    expect(job.status).toBe('failed');
    expect(job.error).toBe('Aborted');
    await new Promise((r) => setTimeout(r, 30));
    const layer = db.prepare(`SELECT id FROM layers WHERE song_id = ? AND kind = 'instrument'`).get(songId);
    expect(layer).toBeUndefined();
  });
});
