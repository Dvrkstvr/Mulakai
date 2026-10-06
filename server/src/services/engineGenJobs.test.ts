import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SongEngine } from './engines/types.js';
import type { EngineJobState } from './engineClient.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-engine-test-'));
process.env.POLL_INTERVAL_MS = '5';

/** One second of 8 kHz mono 16-bit silence — a real WAV, so the duration fallback can read it. */
function wavSecond(): Buffer {
  const data = Buffer.alloc(16000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Encoding is transcode.test.ts's concern; here the master just has to land at outPath.
vi.mock('./transcode.js', () => ({
  transcodeBuffer: async (master: Buffer, outPath: string) => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outPath, master);
  },
  transcodeFile: async () => {},
  probeFfmpeg: async () => true,
}));

const RUNNING: EngineJobState = { state: 'running', truncated: false };
const DONE: EngineJobState = { state: 'done', truncated: false };
const client = {
  submit: vi.fn(async (..._a: unknown[]) => 'wrapper-1'),
  status: vi.fn(async (..._a: unknown[]): Promise<EngineJobState> => DONE),
  fetchAudio: vi.fn(async (..._a: unknown[]) => wavSecond()),
  fetchScore: vi.fn(async (..._a: unknown[]): Promise<string | null> => 'X:1\nQ:1/4=120\nK:Am\nM:4/4\n'),
  cancel: vi.fn(async (..._a: unknown[]) => {}),
};
vi.mock('./engineClient.js', () => ({
  submit: (...a: unknown[]) => client.submit(...a),
  status: (...a: unknown[]) => client.status(...a),
  fetchAudio: (...a: unknown[]) => client.fetchAudio(...a),
  fetchScore: (...a: unknown[]) => client.fetchScore(...a),
  cancel: (...a: unknown[]) => client.cancel(...a),
}));

const { db } = await import('../db/index.js');
const { config } = await import('../config.js');
const { getJob, abortJob } = await import('./jobs.js');
const { getRunning } = await import('./genQueue.js');
const { ACESTEP_CAPABILITIES } = await import('./engines/registry.js');
const { startEngineGeneration, TRUNCATED_LABEL } = await import('./engineGenJobs.js');

const readMeta = vi.fn((r: { score?: string }) =>
  r.score ? { bpm: 120, keyScale: 'A minor', timeSignature: '4' } : { bpm: null, keyScale: '', timeSignature: '' });
const engine: SongEngine = {
  id: 'yue2', label: 'YUE2', url: 'http://127.0.0.1:9000', apiKey: '',
  capabilities: { ...ACESTEP_CAPABILITIES, consequence: 'fake' },
  toRequest: (f) => ({ style: f.prompt, lyrics: f.lyrics, seed: 42 }),
  readMeta,
};
const fields = { prompt: 'dreamy synth pop', lyrics: '[Verse]\nla la', bpm: 92, output: { format: 'wav' } };

async function settle(jobId: string, status: 'done' | 'failed') {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status));
  await vi.waitFor(() => expect(getRunning()).toBeNull());
}

function songOf(jobId: string) {
  const songId = getJob(jobId)!.songId!;
  const song = db.prepare(`SELECT * FROM songs WHERE id = ?`).get(songId) as Record<string, unknown>;
  const version = db.prepare(
    `SELECT v.* FROM versions v JOIN layers l ON v.layer_id = l.id WHERE l.song_id = ? AND l.kind = 'base'`,
  ).get(songId) as Record<string, unknown>;
  return { song, version, params: JSON.parse(version.params_json as string) as Record<string, unknown> };
}

beforeEach(() => {
  for (const fn of Object.values(client)) fn.mockClear();
  client.status.mockImplementation(async () => DONE);
  client.fetchScore.mockImplementation(async () => 'X:1\nQ:1/4=120\nK:Am\nM:4/4\n');
  readMeta.mockClear();
});

describe('startEngineGeneration happy path', () => {
  it('persists a new song with the engine, text2music, no lyric timestamps and readMeta\'s values', async () => {
    const job = startEngineGeneration(engine, fields, 'Engine Song', null);
    await settle(job.id, 'done');

    const { song, version, params } = songOf(job.id);
    expect(song).toMatchObject({
      title: 'Engine Song', caption: 'dreamy synth pop', lyrics: '[Verse]\nla la',
      engine: 'yue2', gen_task: 'text2music', bpm: 120, key_scale: 'A minor', time_signature: '4',
    });
    expect(version).toMatchObject({ label: 'first generation', seed: '42', lyric_timestamps: null, active: 1 });
    expect(params).toMatchObject({
      prompt: 'dreamy synth pop', bpm: 92, engine: 'yue2', task_type: 'text2music',
      request: { style: 'dreamy synth pop', lyrics: '[Verse]\nla la', seed: 42 },
    });
    expect(readMeta).toHaveBeenCalledWith({ score: 'X:1\nQ:1/4=120\nK:Am\nM:4/4\n' });
  });

  it('submits the mapped request under our job id', async () => {
    const job = startEngineGeneration(engine, fields, 'Submit Song');
    await settle(job.id, 'done');
    expect(client.submit).toHaveBeenCalledWith(engine, { style: 'dreamy synth pop', lyrics: '[Verse]\nla la', seed: 42 }, job.id);
  });

  it('reads the duration back from the file, since engines report none', async () => {
    const job = startEngineGeneration(engine, fields, 'Duration Song');
    await settle(job.id, 'done');
    expect(songOf(job.id).song.duration).toBeCloseTo(1, 1);
  });

  it('keeps the score as the version\'s .abc sidecar', async () => {
    const job = startEngineGeneration(engine, fields, 'Score Song');
    await settle(job.id, 'done');
    const { version } = songOf(job.id);
    expect(fs.readFileSync(path.join(config.audioDir, `${version.id}.abc`), 'utf8')).toBe('X:1\nQ:1/4=120\nK:Am\nM:4/4\n');
  });

  it('writes no sidecar and leaves the metadata empty when the engine has no score', async () => {
    client.fetchScore.mockImplementation(async () => null);
    const job = startEngineGeneration(engine, fields, 'No Score Song');
    await settle(job.id, 'done');
    const { song, version } = songOf(job.id);
    expect(fs.existsSync(path.join(config.audioDir, `${version.id}.abc`))).toBe(false);
    expect(song).toMatchObject({ bpm: null, key_scale: '', time_signature: '' });
  });

  it('still keeps the song when fetching the score fails', async () => {
    client.fetchScore.mockImplementation(async () => { throw new Error('YUE2 score download -> HTTP 500'); });
    const job = startEngineGeneration(engine, fields, 'Score Fail Song');
    await settle(job.id, 'done');
    expect(readMeta).toHaveBeenCalledWith({});
  });

  it('calls onSaved with the new song before the job reads done (the chat attaches its thread)', async () => {
    const seen: Array<{ songId: string; status: string | undefined }> = [];
    const job = startEngineGeneration(engine, fields, 'Hook Song', null, undefined, (songId) => { seen.push({ songId, status: getJob(job.id)?.status }); });
    await settle(job.id, 'done');
    expect(seen).toEqual([{ songId: getJob(job.id)!.songId, status: 'running' }]);
  });

  it('a failing onSaved never fails the take', async () => {
    const job = startEngineGeneration(engine, fields, 'Hook Fail', null, undefined, () => { throw new Error('thread gone'); });
    await settle(job.id, 'done');
    expect(getJob(job.id)!.songId).toBeTruthy();
  });

  it('keeps a truncated result under a labelled version', async () => {
    client.status.mockImplementation(async () => ({ state: 'done', truncated: true }));
    const job = startEngineGeneration(engine, fields, 'Truncated Song');
    await settle(job.id, 'done');
    expect(songOf(job.id).version.label).toBe(TRUNCATED_LABEL);
  });
});

describe('startEngineGeneration lock and polling', () => {
  it('holds the queue slot as generate, tagged with the engine, until the job ends; a second waits', async () => {
    let release!: () => void;
    client.status.mockImplementationOnce(() => new Promise((r) => { release = () => r(DONE); }));
    const job = startEngineGeneration(engine, fields, 'Lock Song');
    await vi.waitFor(() => expect(client.status).toHaveBeenCalled());
    expect(getRunning()).toMatchObject({ kind: 'generate', jobId: job.id, task: 'text2music', engine: 'yue2', title: 'Lock Song' });
    const second = startEngineGeneration(engine, fields, 'Second');
    expect(second.status).toBe('queued');
    release();
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('done'));
    await settle(second.id, 'done');
  });

  it('copies progress and stage while the wrapper is running', async () => {
    let finish = false;
    client.status.mockImplementation(async () => (finish ? DONE : { ...RUNNING, progress: 0.25, stage: 'semantic' }));
    const job = startEngineGeneration(engine, fields, 'Progress Song');
    await vi.waitFor(() => expect(getJob(job.id)).toMatchObject({ progress: 0.25, progressStage: 'semantic' }));
    finish = true;
    await settle(job.id, 'done');
  });

  it('rides out two failed status calls in a row', async () => {
    client.status
      .mockImplementationOnce(async () => { throw new Error('flaky'); })
      .mockImplementationOnce(async () => { throw new Error('flaky'); });
    const job = startEngineGeneration(engine, fields, 'Flaky Song');
    await settle(job.id, 'done');
  });

  it('fails the job on the third failed status call in a row', async () => {
    client.status.mockImplementation(async () => { throw new Error('YUE2 status -> fetch failed'); });
    const job = startEngineGeneration(engine, fields, 'Dead Song');
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('YUE2 status -> fetch failed');
    expect(client.status).toHaveBeenCalledTimes(3);
  });

  it("fails the job with the wrapper's own error", async () => {
    client.status.mockImplementation(async () => ({ state: 'failed', truncated: false, error: 'CUDA out of memory' }));
    const job = startEngineGeneration(engine, fields, 'OOM Song');
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('CUDA out of memory');
    expect(client.fetchAudio).not.toHaveBeenCalled();
  });

  it('fails the job and frees the lock when the submit is refused', async () => {
    client.submit.mockImplementationOnce(async () => { throw new Error('YUE2 submit -> HTTP 503: Inference worker is not ready'); });
    const job = startEngineGeneration(engine, fields, 'Refused Song');
    await settle(job.id, 'failed');
    expect(getJob(job.id)?.error).toContain('HTTP 503');
  });
});

describe('startEngineGeneration abort', () => {
  it('sends cancel, holds the slot until the wrapper has stopped, and persists nothing', async () => {
    client.status.mockImplementation(async () => RUNNING);
    let stop!: () => void;
    client.cancel.mockImplementationOnce(async () => {
      stop = () => client.status.mockImplementation(async () => ({ state: 'failed', truncated: false, error: 'cancelled' }));
    });
    const job = startEngineGeneration(engine, fields, 'Aborted Song');
    await vi.waitFor(() => expect(client.status).toHaveBeenCalled());
    abortJob(job.id);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', error: 'Aborted' });
    await vi.waitFor(() => expect(client.cancel).toHaveBeenCalledWith(engine, 'wrapper-1'));
    await new Promise((r) => setTimeout(r, 30));
    expect(getRunning()).toMatchObject({ jobId: job.id, draining: true }); // still on the GPU
    stop();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    expect(db.prepare(`SELECT COUNT(*) AS c FROM songs WHERE title = 'Aborted Song'`).get()).toEqual({ c: 0 });
    client.status.mockImplementation(async () => DONE);
  });

  it('cancels a job aborted while the wrapper was still accepting it', async () => {
    let accept!: (id: string) => void;
    client.submit.mockImplementationOnce(() => new Promise((r) => { accept = r; }));
    const job = startEngineGeneration(engine, fields, 'Abort Submit Song');
    abortJob(job.id);
    accept('wrapper-9');
    await vi.waitFor(() => expect(client.cancel).toHaveBeenCalledWith(engine, 'wrapper-9'));
    // Status is asked only to confirm the wrapper stopped (it says done here), then the slot frees.
    await vi.waitFor(() => expect(getRunning()).toBeNull());
    expect(db.prepare(`SELECT COUNT(*) AS c FROM songs WHERE title = 'Abort Submit Song'`).get()).toEqual({ c: 0 });
  });
});

describe('startEngineGeneration cover', () => {
  const ABC = 'X:1\nQ:1/4=75\nK:Fm\nM:4/4\n';
  const coverEngine: SongEngine = {
    ...engine,
    toCoverRequest: (f, abc) => ({ style: f.prompt, lyrics: f.lyrics, seed: 42, cot: 'melody', abc }),
  };

  it('sends the cover request and stores a cover song with its source and supplied score', async () => {
    const job = startEngineGeneration(coverEngine, fields, 'Cover Song', null, { abc: ABC, source: 'Ellies City 2' });
    expect(getRunning()).toMatchObject({ kind: 'generate', task: 'cover', engine: 'yue2' });
    await settle(job.id, 'done');

    const request = { style: 'dreamy synth pop', lyrics: '[Verse]\nla la', seed: 42, cot: 'melody', abc: ABC };
    expect(client.submit).toHaveBeenCalledWith(coverEngine, request, job.id);
    const { song, params } = songOf(job.id);
    expect(song).toMatchObject({ engine: 'yue2', gen_task: 'cover' });
    expect(params).toMatchObject({ task_type: 'cover', source: 'Ellies City 2', request });
  });

  it('refuses a cover on an engine that cannot cover, before taking the lock', () => {
    expect(() => startEngineGeneration(engine, fields, 'No Cover', null, { abc: ABC, source: 's' })).toThrow(/cannot cover/);
    expect(getRunning()).toBeNull();
  });
});
