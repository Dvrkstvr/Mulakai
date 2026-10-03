import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import http, { type Server } from 'node:http';
import { readScore } from './yueScoreRead.js';

/** Replies recorded by yue-server's pytest (D-039): the fake cannot drift from the real route. */
const CONTRACT = new URL('../../../../yue-server/tests/data/contract/', import.meta.url);
interface Recorded { request: { path: string; body: { abc: string; lyrics?: string } }; response: { status: number; body: unknown } }
const recorded = (name: string): Recorded => JSON.parse(fs.readFileSync(new URL(`${name}.json`, CONTRACT), 'utf8')) as Recorded;
const fixtures = ['read-ok', 'read-invalid-sidecar', 'read-overfull-bar'].map(recorded);

let server: Server;
let target: { label: string; url: string; apiKey: string };
const seen: Array<{ path: string; body: unknown; auth?: string }> = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw) as { abc: string };
      seen.push({ path: req.url ?? '', body, auth: req.headers.authorization });
      if (body.abc === 'BOOM') { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"detail":"kaput"}'); return; }
      const hit = fixtures.find((f) => f.request.path === req.url && f.request.body.abc === body.abc);
      res.writeHead(hit ? hit.response.status : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(hit ? hit.response.body : { detail: 'no recorded reply' }));
    });
  });
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  target = { label: 'YUE2', url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`, apiKey: 'k' };
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('readScore against recorded /v1/scores/read replies', () => {
  it('a valid sidecar: ok, chords present, facts kept', async () => {
    const f = recorded('read-ok');
    const r = await readScore(f.request.body.abc, f.request.body.lyrics ?? '', target);
    expect(r).toMatchObject({ ok: true, error: null, chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832 });
    expect((r.facts as { header: { bars: number } }).header.bars).toBe(65);
    expect(seen.at(-1)).toEqual({ path: '/v1/scores/read', body: { abc: f.request.body.abc, lyrics: f.request.body.lyrics }, auth: 'Bearer k' });
  });

  it('a sidecar upstream refuses: ok false with its error, chords unknown', async () => {
    const f = recorded('read-invalid-sidecar');
    const r = await readScore(f.request.body.abc, null, target);
    expect(r).toMatchObject({ ok: false, error: 'group 60, Ins: expected V: Ins', messages: [], chordsPresent: null, facts: null });
    expect(seen.at(-1)!.body).toEqual({ abc: f.request.body.abc, lyrics: '' });
  });

  it('an overfull bar: the per-bar message survives', async () => {
    const f = recorded('read-overfull-bar');
    const r = await readScore(f.request.body.abc, '', target);
    expect(r.messages).toEqual(['bar 3 (Ins): 36 of 32 units, too long by 4']);
  });

  it('an HTTP error throws with the status and detail', async () => {
    await expect(readScore('BOOM', '', target)).rejects.toThrow('YUE2 read score -> HTTP 500: kaput');
  });

  it('an unreachable server throws', async () => {
    await expect(readScore('x', '', { ...target, url: 'http://127.0.0.1:9' })).rejects.toThrow(/^YUE2 read score -> /);
  });
});
