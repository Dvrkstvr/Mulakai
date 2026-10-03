/** Every ACE-Step job kind waits its turn in genQueue.ts instead of being refused, and reads
 * what it works on when that turn comes (PLAN.md "UI Redesign", S4 decisions 1, 2 and 5). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-queue-test-'));
process.env.POLL_INTERVAL_MS = '5';

let taskSeq = 0;
const releaseTask = vi.fn(async (..._args: unknown[]) => ({ task_id: `task-${(taskSeq += 1)}` }));
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
  queryResult: vi.fn(async (ids: string[]) => [{
    task_id: ids[0], status: 1 as const,
    result: [{ file: '/v1/audio?path=x', status: 1 as const, prompt: '', lyrics: '', metas: {}, seed_value: '7' }],
  }]),
  downloadAudio: vi.fn(async () => Buffer.from('fake-audio-bytes')),
  audioFileExt: () => 'wav',
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./modelLoad.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const { getJob, startGeneration } = await import('./jobs.js');
const { enqueue, getQueued, getRunning, cancelQueuedForSong } = await import('./genQueue.js');
const { startCoverGeneration } = await import('./coverGenJobs.js');
const { startCompleteGeneration } = await import('./completeGenJobs.js');
const { startRepaint, startRegenerate, startSimilarTake } = await import('./repaintJobs.js');
const { startAddLayer } = await import('./addLayerJobs.js');
const { startRemaster } = await import('./remasterJobs.js');
const { startSplit, getSplitJob } = await import('./stemSplit.js');
const { startScratchSplit, getScratchSplitJob } = await import('./scratchSplitJobs.js');
const { LAYER_DELETED, SONG_TRASHED } = await import('./queueGuards.js');

afterEach(async () => {
  await vi.waitFor(() => expect(getRunning()).toBeNull(), { timeout: 5000 });
});

function seedSong(): { songId: string; layerId: string; versionId: string; file: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const file = `${versionId}.wav`;
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Copper Sky')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Vocals', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active) VALUES (?, ?, ?, 'first', ?, '1', 1)`)
    .run(versionId, layerId, file, JSON.stringify({ prompt: 'a song', task_type: 'repaint', repainting_start: 1, repainting_end: 4 }));
  fs.writeFileSync(path.join(config.audioDir, file), 'source audio');
  return { songId, layerId, versionId, file };
}

/** Holds the slot until the returned function is called. */
function holdSlot(): () => void {
  let free!: () => void;
  enqueue({ kind: 'generate', jobId: crypto.randomUUID() }, () => new Promise<void>((r) => { free = r; }));
  return () => free();
}

const status = (id: string) => getJob(id)?.status;
const region = { prompt: 'brighter', repainting_start: 1, repainting_end: 4 };

describe('every kind enters the queue', () => {
  it('queues all of them behind a running job, in order, then runs each', { timeout: 20000 }, async () => {
    const { songId, layerId, versionId } = seedSong();
    const free = holdSlot();
    const jobs = [
      startGeneration({ prompt: 'synthwave' }, 'Gen'),
      startCoverGeneration(Buffer.from('src'), 'Cover', { prompt: 'jazz' }),
      startCompleteGeneration({ data: Buffer.from('src'), filename: 'v.wav' }, 'Complete', { prompt: 'band' }),
      await startRepaint(layerId, region),
      await startRegenerate(versionId),
      await startSimilarTake(versionId),
      await startAddLayer(songId, 'strings', 'Strings', Buffer.from('mix'), {}),
      await startRemaster(songId, Buffer.from('mix'), 'acestep-v15-base'),
    ];
    const split = await startSplit(layerId, 'acestep');
    const scratch = await startScratchSplit({ data: Buffer.from('song'), filename: 'song.wav' }, 'acestep');

    expect(jobs.map((j) => j.status)).toEqual(Array(8).fill('queued'));
    expect(getQueued().map((q) => q.kind)).toEqual([
      'generate', 'generate', 'generate', 'repaint', 'regenerate', 'retake', 'addLayer', 'remaster', 'split', 'split',
    ]);
    expect(getQueued()[3]).toMatchObject({ songId, layer: 'Vocals', label: 'repaint 0:01–0:04', position: 4 });
    expect(getSplitJob(split.id)?.queued).toBe(true);
    expect(getScratchSplitJob(scratch.id)?.queued).toBe(true);
    expect(releaseTask).not.toHaveBeenCalled();

    free();
    for (const job of jobs) await vi.waitFor(() => expect(getJob(job.id)?.error ?? status(job.id)).toBe('done'), { timeout: 5000 });
    await vi.waitFor(() => expect(split.stems.every((s) => s.status === 'done')).toBe(true), { timeout: 5000 });
    await vi.waitFor(() => expect(scratch.stems.every((s) => s.status === 'done')).toBe(true), { timeout: 5000 });
    expect(split.queued).toBe(false);
  });

  it("chains queued edits on one layer: the second repaint reads the first one's result", async () => {
    const { layerId, file } = seedSong();
    releaseTask.mockClear();
    const free = holdSlot();
    const first = await startRepaint(layerId, region);
    const second = await startRepaint(layerId, region);
    free();
    await vi.waitFor(() => expect(status(second.id)).toBe('done'));
    const sources = releaseTask.mock.calls.map((c) => (c[1] as { srcAudio: { filename: string } }).srcAudio.filename);
    expect(sources[0]).toBe(file);
    expect(sources[1]).not.toBe(file);
    expect(status(first.id)).toBe('done');
  });

  it('fails a queued edit whose layer was deleted before its turn, and the queue moves on', async () => {
    const { layerId } = seedSong();
    const other = seedSong();
    const free = holdSlot();
    const doomed = await startRepaint(layerId, region);
    const next = await startRepaint(other.layerId, region);
    db.prepare(`DELETE FROM versions WHERE layer_id = ?`).run(layerId);
    db.prepare(`DELETE FROM layers WHERE id = ?`).run(layerId);
    free();
    await vi.waitFor(() => expect(status(doomed.id)).toBe('failed'));
    expect(getJob(doomed.id)?.error).toBe(LAYER_DELETED);
    await vi.waitFor(() => expect(status(next.id)).toBe('done'));
  });

  it("trashing a song cancels its queued jobs, splits included", async () => {
    const { songId, layerId } = seedSong();
    const free = holdSlot();
    const repaint = await startRepaint(layerId, region);
    const split = await startSplit(layerId, 'acestep');
    expect(cancelQueuedForSong(songId, SONG_TRASHED)).toEqual([repaint.id, split.id]);
    expect(getJob(repaint.id)).toMatchObject({ status: 'failed', error: SONG_TRASHED, cancelled: true });
    expect(getSplitJob(split.id)).toBeUndefined();
    free();
  });

  it('still refuses an unknown layer at submit, before queueing', async () => {
    await expect(startRepaint('nope', region)).rejects.toThrow('unknown layer');
    await expect(startSplit('nope', 'acestep')).rejects.toThrow('unknown layer');
    expect(getQueued()).toEqual([]);
  });
});
