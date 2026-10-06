/** POST /api/scores/midi and GET /api/songs/:id/score/midi (PLAN.md "Export a Score as MIDI"). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { makeScoreMidiRouter, type ScoreMidiDeps } from './scoreMidi.js';
import { ScoreMidiRefused } from '../services/score/yueScoreMidi.js';

const converted: string[] = [];
const deps: ScoreMidiDeps = {
  convert: async (abc) => {
    converted.push(abc);
    if (abc === 'BAD') throw new ScoreMidiRefused('Incomplete native two-voice ABC');
    if (abc === 'DOWN') throw new Error('YUE2 score midi -> fetch failed');
    return Buffer.from(`MIDI:${abc}`);
  },
  songScore: async (id) => (id === 'yue' ? 'X:1 song' : id === 'broken' ? 'DOWN' : null),
};
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', makeScoreMidiRouter(() => deps));
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (body: unknown) => fetch(`${base}/scores/midi`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/scores/midi', () => {
  it('returns the converted file as audio/midi', async () => {
    const res = await post({ abc: 'X:1 file' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/midi');
    expect(await res.text()).toBe('MIDI:X:1 file');
  });

  it('refuses an empty or oversized score before asking yue-server', async () => {
    const before = converted.length;
    expect((await post({ abc: '  ' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ abc: 'x'.repeat(65_537) })).status).toBe(400);
    expect(converted).toHaveLength(before);
  });

  it("passes the parser's reason through as 422, and a failing yue-server as 502", async () => {
    const bad = await post({ abc: 'BAD' });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ error: 'Incomplete native two-voice ABC' });
    const down = await post({ abc: 'DOWN' });
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: 'YUE2 score midi -> fetch failed' });
  });
});

describe('GET /api/songs/:id/score/midi', () => {
  it("converts the song's score", async () => {
    const res = await fetch(`${base}/songs/yue/score/midi`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('MIDI:X:1 song');
  });

  it('is 404 for a take with no score, 502 when yue-server fails', async () => {
    const none = await fetch(`${base}/songs/ace/score/midi`);
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: 'this take has no score' });
    expect((await fetch(`${base}/songs/broken/score/midi`)).status).toBe(502);
  });
});
