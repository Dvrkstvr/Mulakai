import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));
process.env.POLL_INTERVAL_MS = '5';
process.env.DEMUCS_API_URL = 'http://demucs.test';

// The master lands at outPath verbatim — encoding rules live in transcode.test.ts.
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
  downloadAudio: vi.fn(async () => Buffer.from('acestep-stem')),
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));
vi.mock('./jobs.js', () => ({ ensureModelLoaded: vi.fn(async () => {}) }));

const { config } = await import('../config.js');
const { db } = await import('../db/index.js');
const acestep = await import('./acestep.js');
const { getRunning } = await import('./genQueue.js');
const { startSplit, claimStem, getSplitJob, reextractStem, cancelSplit } = await import('./stemSplit.js');
type StemKind = 'vocals' | 'drums' | 'bass' | 'other';

/** Fake Demucs/UVR service: each /split pass serves stems whose bytes name the pass. */
let pass = 0;
let failNextSplit = false;
beforeEach(() => {
  pass = 0;
  failNextSplit = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/split')) {
      if (failNextSplit) return new Response('boom', { status: 500 });
      pass += 1;
      const stems = Object.fromEntries(['vocals', 'drums', 'bass', 'other'].map((k) => [k, `http://demucs.test/audio/${pass}/${k}`]));
      return Response.json({ stems });
    }
    const [, n, kind] = /audio\/(\d+)\/(\w+)$/.exec(url) ?? [];
    return new Response(`pass${n}-${kind}`);
  }));
});

function seedSong(): { songId: string; layerId: string } {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const sourceFile = `${crypto.randomUUID()}.flac`;
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, ?)`).run(songId, 'Test Song');
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label) VALUES (?, ?, ?, 'first generation')`)
    .run(crypto.randomUUID(), layerId, sourceFile);
  fs.writeFileSync(path.join(config.audioDir, sourceFile), 'source audio');
  return { songId, layerId };
}

const stemOf = (jobId: string, kind: StemKind) => getSplitJob(jobId)!.stems.find((s) => s.kind === kind)!;
const bytes = (file: string) => fs.readFileSync(path.join(config.audioDir, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(config.audioDir, file));

// Each split/re-extract holds the global lock until its last step, so wait for that too.
const idle = () => vi.waitFor(() => expect(getRunning()).toBeNull());

async function settledSplit(layerId: string, model: 'acestep' | 'demucs') {
  await idle();
  const job = await startSplit(layerId, model);
  await vi.waitFor(() => expect(job.stems.every((s) => s.status === 'done')).toBe(true));
  await idle();
  return job;
}

describe('stemSplit RE-EXTRACT (Demucs/UVR)', () => {
  it('leaves a claimed stem\'s version row, file and bytes untouched', async () => {
    const { layerId, songId } = seedSong();
    const job = await settledSplit(layerId, 'demucs');
    claimStem(job.id, 'vocals', 'add-layer');
    const claimedFile = stemOf(job.id, 'vocals').audioFile!;

    reextractStem(job.id, 'drums');
    await vi.waitFor(() => expect(stemOf(job.id, 'drums').status).toBe('done'));

    const row = db.prepare(
      `SELECT v.audio_file FROM versions v JOIN layers l ON v.layer_id = l.id WHERE l.song_id = ? AND l.kind = 'vocals'`,
    ).get(songId) as { audio_file: string };
    expect(row.audio_file).toBe(claimedFile);
    expect(bytes(claimedFile)).toBe('pass1-vocals');
    expect(stemOf(job.id, 'vocals')).toMatchObject({ status: 'done', claimed: 'added', audioFile: claimedFile });
  });

  it('keeps only the asked-for stem, under a new file, and deletes the one it supersedes', async () => {
    const { layerId } = seedSong();
    const job = await settledSplit(layerId, 'demucs');
    const before = Object.fromEntries(job.stems.map((s) => [s.kind, s.audioFile!]));

    reextractStem(job.id, 'drums');
    await vi.waitFor(() => expect(exists(before.drums)).toBe(false));

    const drums = stemOf(job.id, 'drums').audioFile!;
    expect(drums).not.toBe(before.drums);
    expect(bytes(drums)).toBe('pass2-drums');
    for (const kind of ['vocals', 'bass', 'other'] as const) {
      expect(stemOf(job.id, kind).audioFile).toBe(before[kind]);
      expect(bytes(before[kind])).toBe(`pass1-${kind}`);
    }
  });

  it('a failed re-run fails only the asked-for stem', async () => {
    const { layerId } = seedSong();
    const job = await settledSplit(layerId, 'demucs');
    claimStem(job.id, 'vocals', 'replace');

    failNextSplit = true;
    reextractStem(job.id, 'bass');
    await vi.waitFor(() => expect(stemOf(job.id, 'bass').status).toBe('failed'));

    expect(job.stems.filter((s) => s.status === 'failed').map((s) => s.kind)).toEqual(['bass']);
  });

  it('refuses to re-extract a claimed stem', async () => {
    const { layerId } = seedSong();
    const job = await settledSplit(layerId, 'demucs');
    claimStem(job.id, 'other', 'add-layer');
    expect(() => reextractStem(job.id, 'other')).toThrow('stem already claimed');
  });
});

describe('stemSplit RE-EXTRACT after REPLACE', () => {
  it('reads the audio the split began from, not the claimed stem now active on the layer', async () => {
    const { layerId } = seedSong();
    const job = await settledSplit(layerId, 'acestep');
    const sourceFile = job.sourceFile;
    claimStem(job.id, 'vocals', 'replace');
    vi.mocked(acestep.releaseTask).mockClear();

    reextractStem(job.id, 'drums');
    await vi.waitFor(() => expect(acestep.releaseTask).toHaveBeenCalled());

    const [, opts] = vi.mocked(acestep.releaseTask).mock.calls[0];
    expect(opts?.srcAudio).toMatchObject({ filename: sourceFile });
    expect(opts?.srcAudio?.data.toString()).toBe('source audio');
  });
});

describe('stemSplit cancelSplit', () => {
  it('deletes unclaimed stem files and keeps claimed ones', async () => {
    const { layerId } = seedSong();
    const job = await settledSplit(layerId, 'demucs');
    claimStem(job.id, 'vocals', 'replace');
    claimStem(job.id, 'bass', 'add-layer');
    const files = Object.fromEntries(job.stems.map((s) => [s.kind, s.audioFile!]));

    await cancelSplit(job.id);

    expect(getSplitJob(job.id)).toBeUndefined();
    expect(exists(files.vocals)).toBe(true);
    expect(exists(files.bass)).toBe(true);
    expect(exists(files.drums)).toBe(false);
    expect(exists(files.other)).toBe(false);
  });
});
