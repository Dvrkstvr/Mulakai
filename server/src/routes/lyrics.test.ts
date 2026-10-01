import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

process.env.LYRICS_API_URL = 'http://127.0.0.1:8005';
process.env.LYRICS_MAX_UPLOAD_MB = '1';

const lyricsHealth = vi.fn(async () => true);
const startLyricsTranscription = vi.fn((..._a: unknown[]) => ({ id: 'lyrics-job-1' }));
vi.mock('../services/lyricsClient.js', () => ({ lyricsHealth: () => lyricsHealth() }));
vi.mock('../services/lyricsJobs.js', () => ({ startLyricsTranscription: (...a: unknown[]) => startLyricsTranscription(...a) }));

const { config } = await import('../config.js');
const { GenLockError } = await import('../services/genLock.js');
const { lyricsRouter } = await import('./lyrics.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/lyrics', lyricsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/lyrics`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  lyricsHealth.mockReset();
  lyricsHealth.mockResolvedValue(true);
  startLyricsTranscription.mockClear();
  config.lyricsUrl = 'http://127.0.0.1:8005';
});

function post(fields: Record<string, string> = {}, file = true) {
  const form = new FormData();
  if (file) form.append('src_audio', new Blob([new Uint8Array([1, 2, 3])]), 'ellies.wav');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
}

describe('GET /api/lyrics/health', () => {
  it('reports configured and ready', async () => {
    expect(await (await fetch(`${baseUrl}/health`)).json()).toEqual({ configured: true, ready: true });
    lyricsHealth.mockResolvedValueOnce(false);
    config.lyricsUrl = '';
    expect(await (await fetch(`${baseUrl}/health`)).json()).toEqual({ configured: false, ready: false });
  });
});

describe('POST /api/lyrics/transcribe', () => {
  it('starts a job from the upload and answers 202 with its id', async () => {
    const res = await post({ language: 'de', source_label: ' Tanz im Loop ' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'lyrics-job-1' });
    const [source] = startLyricsTranscription.mock.calls[0] as [{ data: Buffer; filename: string; label: string; language: string }];
    expect(source).toMatchObject({ filename: 'ellies.wav', label: 'Tanz im Loop', language: 'de' });
    expect([...source.data]).toEqual([1, 2, 3]);
  });

  it('auto-detects without a language and labels the job by filename', async () => {
    await post();
    expect(startLyricsTranscription.mock.calls[0][0]).toMatchObject({ label: 'ellies.wav', language: '' });
  });

  it('400s a missing file or an unknown language', async () => {
    expect((await post({}, false)).status).toBe(400);
    const res = await post({ language: 'German' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('German');
    expect(startLyricsTranscription).not.toHaveBeenCalled();
  });

  it('400s when lyrics-server is not configured or not answering', async () => {
    config.lyricsUrl = '';
    expect((await (await post()).json()).error).toContain('LYRICS_API_URL');
    config.lyricsUrl = 'http://127.0.0.1:8005';
    lyricsHealth.mockResolvedValueOnce(false);
    const res = await post();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('not answering');
    expect(startLyricsTranscription).not.toHaveBeenCalled();
  });

  it('answers an oversized source with a 413 in JSON, not an HTML 500', async () => {
    const form = new FormData();
    form.append('src_audio', new Blob([new Uint8Array(1024 * 1024 + 1)]), 'tanz.wav');
    const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'the source is over 1 MB' });
    expect(startLyricsTranscription).not.toHaveBeenCalled();
  });

  it('answers an unexpected file field with a 400 in JSON', async () => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array([1])]), 'a.wav');
    const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('could not read the upload');
  });

  it('409s while another job holds the lock', async () => {
    startLyricsTranscription.mockImplementationOnce(() => { throw new GenLockError(); });
    expect((await post()).status).toBe(409);
  });
});
