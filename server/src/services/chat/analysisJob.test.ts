/** The version analysis job against fakeYue's recorded replies (F-052, D-171, D-172, D-179; Test strategy (C1)
 * #1): done, partial, failed (audio, guard), cancelled, a newer take saved while it waits, one waiting job per
 * song, trash cancels it, and an already read version reads nothing. */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contract, startFakeYue, transcriptionContract, type FakeYue } from '../../../test-fakes/fakeYue.js';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-analysis-job-'));
process.env.POLL_INTERVAL_MS = '5';
process.env.LLM_API_URL = '';

const { config } = await import('../../config.js');
const { db } = await import('../../db/index.js');
const { getJob } = await import('../jobRegistry.js');
const { enqueue, getRunning, cancelQueuedForSong, queuePosition } = await import('../genQueue.js');
const { yue2Engine } = await import('../engines/yue2.js');
const { readVersionAnalysis } = await import('./analysisStore.js');
const { readGrid } = await import('./gridCache.js');
const { startAnalysis, cancelAnalysis, analysisDeps, analysisWaiting, analysisPending, liveAnalysis } = await import('./analysisJob.js');
type AnalysisDeps = import('./analysisJob.js').AnalysisDeps;

const BARS = contract('scores-bars-ok');
const { abc: ABC, grid: GRID } = BARS.request.body as { abc: string; grid: Record<string, unknown> };
const READING = { language: 'en', segments: [{ text: 'Hey you', start: 0.3, end: 2, words: [] }] };
const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 4 }, { index: 2, label: 'chorus', from_bar: 5, to_bar: 8 }],
  lyric_blocks: [], bar_map: [],
};
let fake: FakeYue;

function deps(over: Partial<AnalysisDeps> = {}): AnalysisDeps {
  return analysisDeps({
    engine: { ...yue2Engine, url: fake.url },
    services: async () => ({ lyrics: true, yue: true, acestep: false }),
    guard: async () => null,
    now: () => new Date('2026-10-07T12:00:00.000Z'),
    steps: {
      lyrics: vi.fn(async () => READING),
      readScore: vi.fn(async () => ({ ok: true, error: null, messages: [], chordsPresent: true, bpm: 120, seconds: 16, tokens: 9, facts: FACTS })),
      measure: vi.fn(async () => null),
    },
    ...over,
  });
}

/** A song whose base layer gets a new active take; `own` writes its YuE2 sidecar, `grid` a cached grid. */
function song() {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'Night Drive')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  return { songId, layerId };
}
function take(layerId: string, opts: { own?: boolean; grid?: boolean; audio?: boolean } = {}) {
  const id = crypto.randomUUID();
  db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active) VALUES (?, ?, ?, ?, 1)`)
    .run(id, layerId, `${id}.flac`, JSON.stringify({ request: { lyrics: '[verse]\nHey you' } }));
  if (opts.audio !== false) fs.writeFileSync(path.join(config.audioDir, `${id}.flac`), 'fLaC');
  if (opts.own) fs.writeFileSync(path.join(config.audioDir, `${id}.abc`), ABC);
  if (opts.grid) fs.writeFileSync(path.join(config.audioDir, `${id}.grid.json`), JSON.stringify(GRID));
  return id;
}
const settled = async (jobId: string, status: 'done' | 'failed') => {
  await vi.waitFor(() => expect(getJob(jobId)?.status).toBe(status), { timeout: 3000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
};
/** Holds the slot until the returned release is called. */
function hold(): () => void {
  let release = () => {};
  enqueue({ kind: 'plan', jobId: `hold-${crypto.randomUUID()}` }, () => new Promise<void>((r) => { release = r; }));
  return () => release();
}

beforeAll(async () => {
  fs.mkdirSync(config.audioDir, { recursive: true });
  fake = await startFakeYue();
});
afterAll(async () => { await fake.close(); });
beforeEach(() => {
  fake.transcription = transcriptionContract('transcription-chords-done');
  fake.transcriptionGrid = contract('transcription-grid-ok') as never;
  fake.requests.length = 0;
});

describe('startAnalysis', () => {
  it('a YuE2 take: one transcribe slot labelled chat analysis, its own score, the cached grid, word timings saved', async () => {
    const { songId, layerId } = song();
    const v = take(layerId, { own: true, grid: true });
    const d = deps();
    const job = startAnalysis(songId, d);
    expect(getRunning()).toMatchObject({ kind: 'transcribe', label: 'chat analysis', songId, title: 'Night Drive', jobId: job.id });
    await settled(job.id, 'done');
    const rec = BARS.response.body as { starts: number[]; end: number; offset: number; agreement: number };
    expect(readVersionAnalysis(v)).toEqual({
      analysis_v: 1, versionId: v, readAt: '2026-10-07T12:00:00.000Z', plan: { words: 'service', score: 'own', sections: 'cached' },
      words: { language: 'en', lines: ['Hey you'], instrumental: false },
      score: expect.objectContaining({ abc: ABC, source: 'own', facts: FACTS }),
      bars: { source: 'cached', offset: rec.offset, starts: rec.starts, end: rec.end, agreement: rec.agreement },
    });
    expect(JSON.parse((db.prepare(`SELECT word_timings FROM versions WHERE id = ?`).get(v) as { word_timings: string }).word_timings)).toEqual(READING);
    expect(fake.requests.some((r) => r.path === '/v1/transcriptions')).toBe(false); // no GPU step but WORDS
  });

  it('a non-YuE2 take: one chords run gives the transcribed score and the grid (cached); unrecorded bars are not read', async () => {
    const { songId, layerId } = song();
    const v = take(layerId);
    const job = startAnalysis(songId, deps());
    await settled(job.id, 'done');
    const a = readVersionAnalysis(v);
    expect(a).toMatchObject({
      plan: { words: 'service', score: 'service', sections: 'score' },
      score: { source: 'transcribed', abc: transcriptionContract('transcription-chords-done').score },
      bars: { notRead: expect.stringContaining('could not time the bars') },
    });
    expect(fake.requests.filter((r) => r.path === '/v1/transcriptions')).toHaveLength(1);
    expect(await readGrid(v)).toEqual(contract('transcription-grid-ok').response.body);
  });

  it('an unreadable audio file fails the job and is stored (D-179); so is a guard refusal', async () => {
    const { songId, layerId } = song();
    const v = take(layerId, { audio: false });
    const job = startAnalysis(songId, deps());
    await settled(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('the audio file is missing');
    expect(readVersionAnalysis(v)).toEqual({ analysis_v: 1, versionId: v, failed: 'the audio file is missing', at: '2026-10-07T12:00:00.000Z' });

    const w = take(layerId);
    const lyrics = vi.fn(async () => READING);
    const refused = startAnalysis(songId, deps({ guard: async () => 'the planner (qwen3:14b) is still on the GPU', steps: { lyrics } }));
    await settled(refused.id, 'failed');
    expect(readVersionAnalysis(w)).toMatchObject({ failed: 'the planner (qwen3:14b) is still on the GPU' });
    expect(lyrics).not.toHaveBeenCalled();
  });

  it('a failed record is read again (RETRY); a version already read reads nothing', async () => {
    const { songId, layerId } = song();
    const v = take(layerId, { own: true, grid: true });
    const first = startAnalysis(songId, deps({ guard: async () => 'busy' }));
    await settled(first.id, 'failed');
    const again = startAnalysis(songId, deps());
    await settled(again.id, 'done');
    expect(readVersionAnalysis(v)).toMatchObject({ bars: { source: 'cached' } });
    const d = deps();
    const third = startAnalysis(songId, d);
    await settled(third.id, 'done');
    expect(d.steps.lyrics).not.toHaveBeenCalled();
  });

  it('one waiting job per song; it reads the newest take when it starts', async () => {
    const release = hold();
    const { songId, layerId } = song();
    const old = take(layerId, { own: true, grid: true });
    const job = startAnalysis(songId, deps());
    expect(startAnalysis(songId, deps())).toBe(job);
    expect(analysisWaiting(songId)).toBe(true);
    expect(liveAnalysis(songId)).toEqual({ jobId: job.id, status: 'queued', ahead: queuePosition(job.id), progressText: null });
    const newer = take(layerId, { own: true, grid: true });
    release();
    await settled(job.id, 'done');
    expect(readVersionAnalysis(newer)).toMatchObject({ versionId: newer });
    expect(readVersionAnalysis(old)).toBeNull();
    expect(liveAnalysis(songId)).toBeNull();
  });

  it('trashing the song cancels a waiting analysis; a new save then queues a fresh one', async () => {
    const release = hold();
    const { songId, layerId } = song();
    take(layerId);
    const job = startAnalysis(songId, deps());
    expect(cancelQueuedForSong(songId, 'the song was moved to the trash')).toEqual([job.id]);
    expect(getJob(job.id)).toMatchObject({ status: 'failed', cancelled: true });
    expect(analysisWaiting(songId)).toBe(false);
    const next = startAnalysis(songId, deps());
    expect(next).not.toBe(job);
    expect(cancelAnalysis(next.id)).toBe(true);
    release();
    await vi.waitFor(() => expect(getRunning()).toBeNull());
  });

  it('a cancel while transcribing stops the run and saves nothing', async () => {
    fake.transcription = transcriptionContract('transcription-hold');
    const { songId, layerId } = song();
    const v = take(layerId);
    const job = startAnalysis(songId, deps());
    await vi.waitFor(() => expect(liveAnalysis(songId)?.progressText).toMatch(/^SCORE/));
    expect(liveAnalysis(songId)).toMatchObject({ jobId: job.id, status: 'running' });
    expect(analysisPending(songId, v)).toBe(true); // a second trigger for this take starts nothing
    expect(analysisPending(songId, 'a-newer-take')).toBe(false);
    expect(cancelAnalysis(job.id)).toBe(true);
    await settled(job.id, 'failed');
    expect(readVersionAnalysis(v)).toBeNull();
    expect(fake.requests.some((r) => r.path.endsWith('/cancel'))).toBe(true);
    expect(cancelAnalysis(job.id)).toBe(false);
  });

  it('a trashed song fails a job that was already past the line', async () => {
    const { songId, layerId } = song();
    take(layerId);
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    const job = startAnalysis(songId, deps());
    await settled(job.id, 'failed');
    expect(getJob(job.id)?.error).toBe('this song no longer exists');
  });
});
