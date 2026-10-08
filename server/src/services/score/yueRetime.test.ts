import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, { type Server } from 'node:http';
import { fetchNotation, retimeScore, RetimeRefused, type NotationBundle } from './yueRetime.js';

let server: Server;
let target: { label: string; url: string; apiKey: string };
const posted: Array<Record<string, unknown>> = [];
const FILES = { 'song_beats.txt': 'MC4w', 'song_melody.mid': 'TVRoZA==' };

const reply = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (req.url === '/v1/transcriptions/t-ok/notation') return reply(res, 200, { files: FILES, chords: true });
      if (req.url === '/v1/transcriptions/t-gone/notation') return reply(res, 404, { detail: { code: 'no_bundle', message: 'none' } });
      if (req.url === '/v1/transcriptions/t-odd/notation') return reply(res, 200, { files: { a: 1 } });
      if (req.url === '/v1/transcriptions/t-down/notation') return reply(res, 500, { detail: 'kaput' });
      const body = JSON.parse(raw) as Record<string, unknown>;
      posted.push({ ...body, auth: req.headers.authorization });
      if (body.mode === 'bpm' && body.bpm === 300) {
        return reply(res, 422, { detail: { code: 'out_of_range', message: '300 BPM is outside 40-240' } });
      }
      if (body.mode === 'double' && (body.files as Record<string, string>)['song_beats.txt'] === 'BOOM') return reply(res, 502, { detail: 'down' });
      reply(res, 200, {
        abc: 'X:1\nQ:1/4=60\n', measures: 22, bpm: 60, read_bpm: 120, vocal_notes: 152, ins_notes: 15,
        notes: 183, dropped_notes: 16, stretched_notes: 16, downbeats: [0.5, 4.5, 'x', 8.5], warnings: ['measure 21: padded'],
      });
    });
  });
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  const addr = server.address();
  target = { label: 'YUE2', url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`, apiKey: 'k' };
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('fetchNotation', () => {
  it('returns the files and whether it was a chords run', async () => {
    expect(await fetchNotation(target, 't-ok')).toEqual({ files: FILES, chords: true });
  });

  it('is null when yue-server kept none or forgot the transcription', async () => {
    expect(await fetchNotation(target, 't-gone')).toBeNull();
  });

  it('throws on an unreadable reply or a failing engine', async () => {
    await expect(fetchNotation(target, 't-odd')).rejects.toThrow(/unreadable/);
    await expect(fetchNotation(target, 't-down')).rejects.toThrow();
  });
});

describe('retimeScore', () => {
  const bundle: NotationBundle = { files: FILES, chords: false };

  it('posts the files and the mode, melody-only unless it was a chords run, and reads the facts', async () => {
    const out = await retimeScore(bundle, 'half', null, target);
    expect(out).toEqual({
      abc: 'X:1\nQ:1/4=60\n', measures: 22, bpm: 60, readBpm: 120, vocalNotes: 152, insNotes: 15,
      notes: 183, droppedNotes: 16, leftOut: [], downbeats: [0.5, 4.5, 8.5], warnings: ['measure 21: padded'],
    });
    expect(posted.at(-1)).toEqual({ files: FILES, mode: 'half', melody_only: true, auth: 'Bearer k' });
    await retimeScore(bundle, 'half', null, target, 'X:1 sung');
    expect(posted.at(-1)).toMatchObject({ keep_like: 'X:1 sung' }); // RT-4: keep the cover's sections
    await retimeScore({ ...bundle, chords: true }, 'bpm', 92, target);
    expect(posted.at(-1)).toMatchObject({ mode: 'bpm', bpm: 92, melody_only: false });
  });

  it("throws RetimeRefused with yue-server's code on a 422", async () => {
    const err = await retimeScore(bundle, 'bpm', 300, target).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RetimeRefused);
    expect(err).toMatchObject({ code: 'out_of_range', message: '300 BPM is outside 40-240' });
  });

  it('throws a plain error when the engine fails or is not set up', async () => {
    const err = await retimeScore({ files: { 'song_beats.txt': 'BOOM' }, chords: false }, 'double', null, target).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(RetimeRefused);
    await expect(retimeScore(bundle, 'half', null, { label: 'YUE2', url: '', apiKey: '' })).rejects.toThrow(/YUE_API_URL/);
  });
});
