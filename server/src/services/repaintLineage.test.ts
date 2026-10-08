/** A repaint (and a repaint replay) names the version it edited, `basedOn`, for the chat's lineage (C1 code review
 * should 1): the layer's active take when the job starts, not the newest one; never sent to ACE-Step. */
import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';

const releaseTask = vi.fn(async (..._args: unknown[]) => ({ task_id: 'task-1' }));
vi.mock('./acestep.js', () => ({
  releaseTask: (...args: unknown[]) => releaseTask(...args),
  queryResult: vi.fn(async () => [{
    task_id: 'task-1', status: 1 as const,
    result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: 's' }],
  }]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: (format?: string) => format ?? 'wav',
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', async () => {
  const actual = await vi.importActual<typeof import('./jobs.js')>('./jobs.js');
  return { ...actual, ensureModelLoaded: vi.fn(async () => {}) };
});

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { getJob } = await import('./jobs.js');
const { startRegenerate, startRepaint } = await import('./repaintJobs.js');
const { lineage } = await import('./chat/analysisStore.js');

const CUT = { score_v: 1, task_type: 'score', ops: [{ op: 'CUT', section: 1, label: 'verse' }] };

/** v1 -> v2 (a CUT, or `v2Params`) on the base layer, then v1 made active again in the Editor. */
function song(v2Params: object = CUT) {
  const [songId, layerId, v1, v2] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'S')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  const insert = db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active, created_at)
    VALUES (?, ?, ?, 'x', ?, '1', ?, ?)`);
  insert.run(v1, layerId, `${v1}.wav`, JSON.stringify({ prompt: 'a song', task_type: 'text2music' }), 1, '2026-10-01');
  insert.run(v2, layerId, `${v2}.wav`, JSON.stringify({ ...v2Params, basedOn: v1 }), 0, '2026-10-02');
  for (const v of [v1, v2]) fs.writeFileSync(path.join(config.audioDir, `${v}.wav`), 'audio');
  return { layerId, v1, v2 };
}
const newest = (layerId: string) => db.prepare(`SELECT id, params_json FROM versions WHERE layer_id = ? ORDER BY rowid DESC LIMIT 1`)
  .get(layerId) as { id: string; params_json: string };
const done = (id: string) => vi.waitFor(() => expect(getJob(id)?.status).toBe('done'));

describe('basedOn on a repaint', () => {
  it('v1 -> v2 (CUT) -> v1 active -> repaint -> v3: v3 is based on v1, not v2; ACE-Step gets no basedOn', async () => {
    releaseTask.mockClear();
    const { layerId, v1, v2 } = song();
    const job = await startRepaint(layerId, { prompt: 'a song', repainting_start: 0, repainting_end: 10 });
    await done(job.id);
    const v3 = newest(layerId);
    expect(v3.id).not.toBe(v2);
    expect(JSON.parse(v3.params_json)).toMatchObject({ task_type: 'repaint', basedOn: v1 });
    expect(lineage(v3.id)).toMatchObject({ fromVersionId: v1, from: 'basedOn' });
    expect(releaseTask.mock.calls[0][0]).not.toHaveProperty('basedOn');
  });

  it("ALT of a repaint: based on the layer's active take it repaints; the stored basedOn is not replayed to ACE-Step", async () => {
    releaseTask.mockClear();
    const { layerId, v1, v2 } = song({ prompt: 'a song', task_type: 'repaint', repainting_start: 0, repainting_end: 10 });
    const job = await startRegenerate(v2);
    await done(job.id);
    expect(JSON.parse(newest(layerId).params_json)).toMatchObject({ task_type: 'repaint', basedOn: v1 });
    expect(releaseTask.mock.calls[0][0]).not.toHaveProperty('basedOn');
  });

  it('ALT of a first take (no source audio) names no parent', async () => {
    const { layerId, v1 } = song();
    const job = await startRegenerate(v1);
    await done(job.id);
    expect(JSON.parse(newest(layerId).params_json)).not.toHaveProperty('basedOn');
  });
});
