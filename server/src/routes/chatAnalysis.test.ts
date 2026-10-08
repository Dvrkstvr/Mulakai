/** The analysis routes on a temp DATA_DIR (F-052, F-053, D-179): the view's states (none, queued, done, failed),
 * RETRY's answers, and the song-thread GET that queues a missing analysis (D-172). */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-analysis-route-'));
process.env.LLM_API_URL = '';

const { db } = await import('../db/index.js');
const { enqueue, QueueFullError } = await import('../services/genQueue.js');
const { writeAnalysis } = await import('../services/chat/analysisStore.js');
const { analysisDeps, startAnalysis } = await import('../services/chat/analysisJob.js');
const { makeChatAnalysisRouter } = await import('./chatAnalysis.js');
const { makeChatRouter } = await import('./chat.js');
type Job = import('../services/jobRegistry.js').Job;

const start = vi.fn((_songId: string): Job => ({ id: 'retry-job', taskId: '', status: 'queued', createdAt: 0 }));
const ensure = vi.fn();
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatAnalysisRouter({ start: (id) => start(id) }));
  app.use('/api/chat', makeChatRouter({ status: async () => ({ configured: true, assistant: 'ok', cause: null, yue: 'ok' }), yueConfigured: () => true, ensureAnalysis: ensure }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/chat`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call(method: string, route: string) {
  const res = await fetch(`${base}${route}`, { method });
  return { status: res.status, body: await res.json() as Record<string, any> };
}

function song(withTake = true) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const v = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'S')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  if (withTake) db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active) VALUES (?, ?, 'a.flac', 1)`).run(v, layer);
  return { songId, v };
}
const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 120, key: 'C', bars: 8, seconds: 16, units_per_quarter: 8 }, key_notes: '',
  sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: 4 }, { index: 2, label: 'chorus', from_bar: 5, to_bar: 8 }],
  lyric_blocks: [{ index: 1, tag: 'verse', occurrence: 1, lines: 4, first_line: 'Hey' }], bar_map: [],
};
const read = (versionId: string) => ({
  analysis_v: 1 as const, versionId, readAt: '2026-10-07T12:00:00.000Z', plan: { words: 'skip', score: 'own', sections: 'cached' } as const,
  words: { notRead: 'LYRICS_API_URL is not set' },
  score: { abc: 'X:1', source: 'own' as const, chords: true, facts: FACTS, warnings: [], measure: null },
  bars: { source: 'cached' as const, offset: 0, starts: [0, 2, 4, 6, 8, 10, 12, 14], end: 16, agreement: 1 },
});

describe('GET /songs/:songId/analysis', () => {
  it('404 for an unknown or trashed song; none for an unread take', async () => {
    expect((await call('GET', '/songs/nope/analysis')).status).toBe(404);
    const { songId, v } = song();
    const { body } = await call('GET', `/songs/${songId}/analysis`);
    expect(body).toEqual({ songId, versionId: v, number: 1, state: { kind: 'none' }, shown: null, lineage: null });
  });

  it('a read take: done, the strip from its score and bars', async () => {
    const { songId, v } = song();
    writeAnalysis(read(v));
    const { body } = await call('GET', `/songs/${songId}/analysis`);
    expect(body.state).toEqual({ kind: 'done' });
    expect(body.shown).toMatchObject({ versionId: v, mode: 'current', bars: { starts: [0, 2, 4, 6, 8, 10, 12, 14], end: 16 }, lines: 4, transcribed: false });
    expect(body.shown.sections.map((s: { label: string; seconds: number[] }) => [s.label, s.seconds])).toEqual([['verse', [0, 8]], ['chorus', [8, 16]]]);
  });

  it("C2: shown.lyrics from the take's stored lyrics (params_json.request), paired with the strip's sections", async () => {
    const { songId, v } = song();
    const lyrics = '[Verse]\nHey there\nsecond line\n\n[Chorus]\nla la';
    db.prepare(`UPDATE versions SET params_json = ? WHERE id = ?`).run(JSON.stringify({ engine: 'yue2', request: { style: 'indie', lyrics } }), v);
    const blocks = [{ index: 1, tag: '[Verse]', occurrence: 1, lines: 2, first_line: 'Hey there' }, { index: 2, tag: '[Chorus]', occurrence: 1, lines: 1, first_line: 'la la' }];
    const r = read(v);
    writeAnalysis({ ...r, score: { ...r.score, facts: { ...FACTS, lyric_blocks: blocks } } });
    const { body } = await call('GET', `/songs/${songId}/analysis`);
    expect(body.shown.lyrics).toMatchObject({ source: 'blocks', note: null, text: lyrics, facts: { bpm: 120, key: 'C', meter: '4/4', style: 'indie' } });
    expect(body.shown.lyrics.sections).toEqual([
      { strip: 1, label: 'verse', occurrence: 1, bars: [1, 4], seconds: [0, 8], block: 1, lines: [{ n: 1, text: 'Hey there', at: { textLine: 1 } }, { n: 2, text: 'second line', at: { textLine: 2 } }] },
      { strip: 2, label: 'chorus', occurrence: 1, bars: [5, 8], seconds: [8, 16], block: 2, lines: [{ n: 1, text: 'la la', at: { textLine: 5 } }] },
    ]);
  });

  it('a waiting analysis reads queued with the jobs ahead; a failed one reads failed with the reason', async () => {
    let release = () => {};
    enqueue({ kind: 'plan', jobId: `hold-${crypto.randomUUID()}` }, () => new Promise<void>((r) => { release = r; }));
    const { songId, v } = song();
    const job = startAnalysis(songId, analysisDeps({ guard: async () => 'the planner is still on the GPU', now: () => new Date('2026-10-07T12:00:00.000Z') }));
    expect((await call('GET', `/songs/${songId}/analysis`)).body.state).toEqual({ kind: 'queued', jobId: job.id, ahead: 1 });
    release();
    await vi.waitFor(() => expect(job.status).toBe('failed'));
    const { body } = await call('GET', `/songs/${songId}/analysis`);
    expect(body.state).toEqual({ kind: 'failed', reason: 'the planner is still on the GPU', at: '2026-10-07T12:00:00.000Z' });
    expect(body.versionId).toBe(v);
  });
});

describe('POST /songs/:songId/analysis/retry', () => {
  it('202 with the job for a failed or unread take', async () => {
    const { songId, v } = song();
    writeAnalysis({ analysis_v: 1, versionId: v, failed: 'the audio file is missing', at: 't' });
    expect(await call('POST', `/songs/${songId}/analysis/retry`)).toEqual({ status: 202, body: { jobId: 'retry-job' } });
    expect(start).toHaveBeenLastCalledWith(songId);
  });

  it('C1 live B1: 202 for a reading whose SCORE service failed (stored done, but not read)', async () => {
    const { songId, v } = song();
    const r = read(v);
    writeAnalysis({ ...r, plan: { ...r.plan, score: 'service' }, score: { notRead: 'YUE2 transcribe -> fetch failed' } });
    expect(await call('POST', `/songs/${songId}/analysis/retry`)).toEqual({ status: 202, body: { jobId: 'retry-job' } });
  });

  it('409 with a reason: no take, already read, the queue is full; 404 for an unknown song', async () => {
    expect(await call('POST', `/songs/${song(false).songId}/analysis/retry`)).toEqual({ status: 409, body: { reason: 'this song has no take to read' } });
    const { songId, v } = song();
    writeAnalysis(read(v));
    expect(await call('POST', `/songs/${songId}/analysis/retry`)).toEqual({ status: 409, body: { reason: 'v1 is already read' } });
    const unread = song().songId;
    start.mockImplementationOnce(() => { throw new QueueFullError(); });
    const full = await call('POST', `/songs/${unread}/analysis/retry`);
    expect(full.status).toBe(409);
    expect(full.body.reason).toEqual(expect.any(String));
    expect((await call('POST', '/songs/nope/analysis/retry')).status).toBe(404);
  });
});

describe('GET /songs/:songId/thread (D-172)', () => {
  it('queues the analysis of a song opened in the chat (imports, songs older than C1)', async () => {
    const { songId } = song();
    expect((await call('GET', `/songs/${songId}/thread`)).status).toBe(200);
    expect(ensure).toHaveBeenCalledWith(songId);
    ensure.mockClear();
    expect((await call('GET', '/songs/nope/thread')).status).toBe(404);
    expect(ensure).not.toHaveBeenCalled();
  });
});
