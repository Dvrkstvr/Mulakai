import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
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
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  // resolveInferenceSteps() consults the inventory to fill STEPS AUTO; an empty one
  // keeps ACE-Step's own legacy default, so these tests' params are unaffected.
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { startSplit, claimStem, getSplitJob } = await import('./stemSplit.js');

function seedSong(): { songId: string; layerId: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(songId, 'Test Song');
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label) VALUES (?, ?, 'base.mp3', 'first generation')`).run(versionId, layerId);
  fs.writeFileSync(path.join(config.audioDir, 'base.mp3'), 'source audio');
  return { songId, layerId };
}

async function runToCompletion(layerId: string) {
  const job = await startSplit(layerId, 'acestep');
  await vi.waitFor(() => {
    const current = getSplitJob(job.id);
    expect(current?.stems.every((s) => s.status === 'done')).toBe(true);
  });
  return job;
}

describe('stemSplit claimStem', () => {
  it('replace creates a new active version on the source layer, keeping the old one in history', async () => {
    const { layerId } = seedSong();
    const job = await runToCompletion(layerId);

    const before = db.prepare(`SELECT COUNT(*) as c FROM versions WHERE layer_id = ?`).get(layerId) as { c: number };
    claimStem(job.id, 'vocals', 'replace');
    const after = db.prepare(`SELECT COUNT(*) as c FROM versions WHERE layer_id = ?`).get(layerId) as { c: number };
    expect(after.c).toBe(before.c + 1);

    const active = db.prepare(`SELECT audio_file FROM versions WHERE layer_id = ? AND active = 1`).get(layerId) as { audio_file: string };
    expect(active.audio_file).toContain('vocals');
  });

  it('add-layer creates a new layer + version pair', async () => {
    const { songId, layerId } = seedSong();
    const job = await runToCompletion(layerId);

    const layersBefore = db.prepare(`SELECT COUNT(*) as c FROM layers WHERE song_id = ?`).get(songId) as { c: number };
    claimStem(job.id, 'drums', 'add-layer');
    const layersAfter = db.prepare(`SELECT COUNT(*) as c FROM layers WHERE song_id = ?`).get(songId) as { c: number };
    expect(layersAfter.c).toBe(layersBefore.c + 1);

    const newLayer = db.prepare(`SELECT kind FROM layers WHERE song_id = ? AND kind = 'drums'`).get(songId) as { kind: string } | undefined;
    expect(newLayer?.kind).toBe('drums');
  });

  it('rejects a second claim on an already-claimed stem', async () => {
    const { layerId } = seedSong();
    const job = await runToCompletion(layerId);

    claimStem(job.id, 'bass', 'add-layer');
    expect(() => claimStem(job.id, 'bass', 'replace')).toThrow();
  });
});
