/** GET /api/scores/notation/:id and POST /api/scores/retime (PLAN.md "Re-time a Transcription"). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { makeScoreRetimeRouter, type ScoreRetimeDeps } from './scoreRetime.js';
import { RetimeRefused, type RetimeResult } from '../services/score/yueRetime.js';

const RESULT: RetimeResult = {
  abc: 'X:1', measures: 22, bpm: 60, readBpm: 120, vocalNotes: 1, insNotes: 0, notes: 1, droppedNotes: 0, warnings: [],
};
const calls: unknown[][] = [];
const deps: ScoreRetimeDeps = {
  load: async (id) => (id === 'kept' ? { files: { a: 'b' }, chords: true } : null),
  retime: async (...a) => {
    calls.push(a);
    if (a[2] === 300) throw new RetimeRefused('out_of_range', '300 BPM is outside 40-240');
    if (a[2] === 99) throw new Error('YUE2 score retime -> fetch failed');
    return RESULT;
  },
};
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', makeScoreRetimeRouter(() => deps));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (body: unknown) => fetch(`${base}/scores/retime`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('GET /api/scores/notation/:id', () => {
  it('says whether the kept reading is still here', async () => {
    expect(await (await fetch(`${base}/scores/notation/kept`)).json()).toEqual({ chords: true });
    const gone = await fetch(`${base}/scores/notation/gone`);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toMatchObject({ code: 'no_bundle' });
  });
});

describe('POST /api/scores/retime', () => {
  it('rebuilds from the kept files; a BPM is sent only in bpm mode', async () => {
    const res = await post({ notationId: 'kept', mode: 'half', bpm: 92 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    expect(calls.at(-1)).toEqual([{ files: { a: 'b' }, chords: true }, 'half', null]);
    await post({ notationId: 'kept', mode: 'bpm', bpm: 92 });
    expect(calls.at(-1)?.slice(1)).toEqual(['bpm', 92]);
  });

  it('refuses a bad request before loading anything', async () => {
    const before = calls.length;
    expect((await post({ mode: 'half' })).status).toBe(400);
    expect((await post({ notationId: 'kept', mode: 'triple' })).status).toBe(400);
    expect((await post({ notationId: 'kept', mode: 'bpm' })).status).toBe(400);
    expect(calls).toHaveLength(before);
  });

  it('is 404 no_bundle when the kept reading is gone', async () => {
    const res = await post({ notationId: 'gone', mode: 'double' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'no_bundle' });
  });

  it("passes yue-server's refusal code on as 422, and an engine failure as 502", async () => {
    const refused = await post({ notationId: 'kept', mode: 'bpm', bpm: 300 });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ code: 'out_of_range', error: '300 BPM is outside 40-240' });
    expect((await post({ notationId: 'kept', mode: 'bpm', bpm: 99 })).status).toBe(502);
  });
});
