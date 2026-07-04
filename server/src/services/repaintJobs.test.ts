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
      result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: 'resolved-seed' }],
    },
  ]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
}));
vi.mock('./jobs.js', async () => {
  const actual = await vi.importActual<typeof import('./jobs.js')>('./jobs.js');
  return { ...actual, ensureModelLoaded: vi.fn(async () => {}) };
});

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { getJob } = await import('./jobs.js');
const { startRegenerate, startSimilarTake } = await import('./repaintJobs.js');

function seedVersion(seed = 'original-seed-123'): { layerId: string; versionId: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(songId, 'Test Song');
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed)
     VALUES (?, ?, 'base.mp3', 'first generation', ?, ?)`,
  ).run(versionId, layerId, JSON.stringify({ prompt: 'a song', task_type: 'text2music', seed }), seed);
  fs.writeFileSync(path.join(config.audioDir, 'base.mp3'), 'source audio');
  return { layerId, versionId };
}

async function waitForDone(jobId: string) {
  await vi.waitFor(() => {
    expect(getJob(jobId)?.status).toBe('done');
  });
}

describe('startSimilarTake', () => {
  it('anchors on the version\'s stored seed via retake_seed and a subtle default retake_variance', async () => {
    releaseTask.mockClear();
    const { versionId } = seedVersion('seed-abc');

    const job = await startSimilarTake(versionId);
    await waitForDone(job.id);

    expect(releaseTask).toHaveBeenCalledTimes(1);
    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    expect(params.retake_seed).toBe('seed-abc');
    expect(params.retake_variance).toBeGreaterThan(0);
    expect(params.retake_variance).toBeLessThanOrEqual(0.15);
    expect(params.use_random_seed).toBe(true);
  });

  it('appends a new version to history without activating it', async () => {
    const { layerId, versionId } = seedVersion();
    const before = db.prepare(`SELECT COUNT(*) as c FROM versions WHERE layer_id = ?`).get(layerId) as { c: number };

    const job = await startSimilarTake(versionId);
    await waitForDone(job.id);

    const after = db.prepare(`SELECT COUNT(*) as c FROM versions WHERE layer_id = ?`).get(layerId) as { c: number };
    expect(after.c).toBe(before.c + 1);

    const active = db.prepare(`SELECT id FROM versions WHERE layer_id = ? AND active = 1`).get(layerId) as { id: string };
    expect(active.id).toBe(versionId);
  });

  it('rejects an unknown version', async () => {
    await expect(startSimilarTake(crypto.randomUUID())).rejects.toThrow('unknown version');
  });
});

describe('startRegenerate (baseline, for comparison)', () => {
  it('does not set retake_seed/retake_variance', async () => {
    releaseTask.mockClear();
    const { versionId } = seedVersion('seed-xyz');

    const job = await startRegenerate(versionId);
    await waitForDone(job.id);

    const [params] = releaseTask.mock.calls[0] as [Record<string, unknown>];
    expect(params.retake_seed).toBeUndefined();
    expect(params.retake_variance).toBeUndefined();
  });
});
