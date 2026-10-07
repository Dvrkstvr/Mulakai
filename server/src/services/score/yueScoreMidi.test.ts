import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import { scoreToMidi, ScoreMidiRefused } from './yueScoreMidi.js';

let server: Server;
let target: { label: string; url: string; apiKey: string };
const seen: Array<{ path: string; abc: string; auth?: string }> = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const { abc } = JSON.parse(raw) as { abc: string };
      seen.push({ path: req.url ?? '', abc, auth: req.headers.authorization });
      if (abc === 'BAD') { res.writeHead(422, { 'Content-Type': 'application/json' }); res.end('{"detail":"Incomplete native two-voice ABC"}'); return; }
      if (abc === 'BOOM') { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"detail":"kaput"}'); return; }
      res.writeHead(200, { 'Content-Type': 'audio/midi' });
      res.end(Buffer.from('MThd-fake'));
    });
  });
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  target = { label: 'YUE2', url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`, apiKey: 'k' };
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('scoreToMidi', () => {
  it('posts the score with the bearer key and returns the file bytes', async () => {
    const midi = await scoreToMidi('X:1', target);
    expect(midi.toString()).toBe('MThd-fake');
    expect(seen.at(-1)).toEqual({ path: '/v1/scores/midi', abc: 'X:1', auth: 'Bearer k' });
  });

  it("throws ScoreMidiRefused with the parser's reason on a 422", async () => {
    const err = await scoreToMidi('BAD', target).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScoreMidiRefused);
    expect((err as Error).message).toBe('Incomplete native two-voice ABC');
  });

  it('any other failure is the engine failing, not the score', async () => {
    const err = await scoreToMidi('BOOM', target).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ScoreMidiRefused);
    expect((err as Error).message).toBe('YUE2 score midi -> HTTP 500: kaput');
  });

  it('says YuE2 is not set up when it has no URL', async () => {
    await expect(scoreToMidi('X:1', { label: 'YUE2', url: '', apiKey: '' })).rejects.toThrow('YUE2 is not set up (YUE_API_URL)');
  });
});
