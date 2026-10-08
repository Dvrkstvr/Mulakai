/** RE-TIME on the chat reading (RT-5, F-092) on a temp DATA_DIR: HALF replaces the stored reading (half the bars at
 * the same seconds), a mark on the old bars goes stale at SEND's resolve, UNDO restores both, refusals change nothing,
 * TRANSCRIBE AGAIN only when the kept reading is gone. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chat-retime-route-'));
process.env.LLM_API_URL = '';

const { db } = await import('../db/index.js');
const { readVersionAnalysis, writeAnalysis } = await import('../services/chat/analysisStore.js');
const { markAt } = await import('../services/chat/songStateSource.js');
const { makeChatRetimeRouter } = await import('./chatRetime.js');
type Job = import('../services/jobRegistry.js').Job;

const start = vi.fn((_songId: string): Job => ({ id: 'again-job', taskId: '', status: 'queued', createdAt: 0 }));
const facts = (bpm: number, bars: number) => ({
  header: { meter: '4/4', unit: '1/8', bpm, key: 'Am', bars, seconds: 16, units_per_quarter: 2 }, key_notes: '',
  sections: [{ index: 1, label: 'verse', from_bar: 1, to_bar: bars / 2 }, { index: 2, label: 'chorus', from_bar: bars / 2 + 1, to_bar: bars }],
  lyric_blocks: [], bar_map: [],
});
const starts = (n: number, len: number) => Array.from({ length: n }, (_, i) => i * len);
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', makeChatRetimeRouter({
    load: async (id) => (id === 'kept' ? { files: { a: 'b' }, chords: true } : null),
    retime: async (_b, mode) => {
      if (mode === 'bpm') throw new (await import('../services/score/yueRetime.js')).RetimeRefused('out_of_range', '300 BPM is outside 40-240');
      return { abc: 'X:1 half', measures: 4, bpm: 60, readBpm: 120, vocalNotes: 1, insNotes: 0, notes: 8, droppedNotes: 2, leftOut: [], downbeats: [0, 4, 8, 12, 16], warnings: [] };
    },
    readScore: async () => ({ ok: true, error: null, messages: [], chordsPresent: true, tokens: 1, facts: facts(60, 4) }),
    measure: async () => null,
    readGrid: async () => ({ grid_v: 1, source: 'tracked', downbeats: starts(8, 2), chords: [], duration: 16 }),
    now: () => new Date('2026-10-08T02:00:00.000Z'),
    start: (id) => start(id),
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/chat`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function post(route: string, body: unknown) {
  const res = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() as Record<string, any> };
}

const READ_AT = '2026-10-08T01:00:00.000Z';
function song(notationId: string | null = 'kept', source: 'own' | 'transcribed' = 'transcribed') {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const v = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title) VALUES (?, 'S')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, active) VALUES (?, ?, 'a.flac', 1)`).run(v, layer);
  writeAnalysis({
    analysis_v: 1, versionId: v, readAt: READ_AT, plan: { words: 'skip', score: 'service', sections: 'score' },
    words: { notRead: 'LYRICS_API_URL is not set' },
    score: { abc: 'X:1', source, chords: true, facts: facts(120, 8), warnings: [], measure: null, notationId },
    bars: { source: 'tracked', offset: 0, starts: starts(8, 2), end: 16, agreement: 1 },
  });
  return { songId, v };
}

describe('POST /songs/:songId/analysis/retime', () => {
  it('HALF: the strip shows half the bars at the same seconds; a mark on the old bars is stale; UNDO restores both', async () => {
    const { songId, v } = song();
    const mark = { kind: 'range' as const, versionId: v, bars: [5, 8] as [number, number], seconds: [8, 16] as [number, number], readAt: READ_AT };
    expect(markAt(songId, mark).ok).toBe(true);
    const { status, body } = await post(`/songs/${songId}/analysis/retime`, { versionId: v, mode: 'half' });
    expect(status).toBe(200);
    expect(body.shown.bars).toEqual({ starts: [0, 4, 8, 12], end: 16 });
    expect(body.shown.sections.map((s: { bars: number[]; seconds: number[] }) => [s.bars, s.seconds])).toEqual([[[1, 2], [0, 8]], [[3, 4], [8, 16]]]);
    expect(body.shown.retime).toMatchObject({ notationId: 'kept', read: { bpm: 120, bars: 8 }, retimed: { mode: 'half', bpm: 60, toBars: 4, droppedNotes: 2 } });
    expect(markAt(songId, mark)).toMatchObject({ ok: false, stale: { reason: expect.stringMatching(/re-timed after you marked it/) } });

    const undo = await post(`/songs/${songId}/analysis/retime/undo`, { versionId: v });
    expect(undo.body.shown.bars).toEqual({ starts: starts(8, 2), end: 16 });
    expect(undo.body.shown.retime.retimed).toBeNull();
    expect(markAt(songId, mark).ok).toBe(true);
    expect((await post(`/songs/${songId}/analysis/retime/undo`, { versionId: v })).status).toBe(409);
  });

  it('refuses, changing nothing: a bad body, another version, an own score, a refused BPM, a gone bundle', async () => {
    const { songId, v } = song();
    expect((await post(`/songs/${songId}/analysis/retime`, { versionId: v, mode: 'slow' })).status).toBe(400);
    expect((await post(`/songs/${songId}/analysis/retime`, { versionId: 'other', mode: 'half' })).status).toBe(409);
    expect(await post(`/songs/${songId}/analysis/retime`, { versionId: v, mode: 'bpm', bpm: 300 }))
      .toEqual({ status: 422, body: { code: 'out_of_range', reason: '300 BPM is outside 40-240' } });
    expect(readVersionAnalysis(v)).toMatchObject({ readAt: READ_AT });
    const own = song('kept', 'own');
    expect((await post(`/songs/${own.songId}/analysis/retime`, { versionId: own.v, mode: 'half' })).status).toBe(409);
    const gone = song('swept');
    expect((await post(`/songs/${gone.songId}/analysis/retime`, { versionId: gone.v, mode: 'half' })).body.code).toBe('no_bundle');
  });
});

describe('POST /songs/:songId/analysis/again', () => {
  it('reads the version again only when its kept reading is gone', async () => {
    const kept = song();
    expect((await post(`/songs/${kept.songId}/analysis/again`, { versionId: kept.v })).status).toBe(409);
    expect(start).not.toHaveBeenCalled();
    const gone = song(null);
    expect(await post(`/songs/${gone.songId}/analysis/again`, { versionId: gone.v })).toEqual({ status: 202, body: { jobId: 'again-job' } });
    expect(start).toHaveBeenCalledWith(gone.songId);
    expect(readVersionAnalysis(gone.v)).toBeNull(); // the job reads only a version with no complete reading
  });
});
