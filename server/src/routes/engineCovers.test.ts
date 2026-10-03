import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { SongEngine } from '../services/engines/types.js';

process.env.COVER_MAX_UPLOAD_MB = '1';

const yue: Partial<SongEngine> = { id: 'yue2', label: 'YUE2', url: 'http://127.0.0.1:9000', toCoverRequest: () => ({}) };
const noCover: Partial<SongEngine> = { id: 'heartmula', label: 'HEARTMULA', url: 'http://127.0.0.1:9001' };
const unset: Partial<SongEngine> = { ...yue, id: 'yue2' as const, url: '' };
const engines: Record<string, Partial<SongEngine>> = { yue2: yue, heartmula: noCover, offline: unset };

const coverReady = vi.fn(async (_e: unknown) => true);
vi.mock('../services/engines/registry.js', () => ({
  getEngine: vi.fn((id: string) => engines[id]),
  coverReady: (e: unknown) => coverReady(e),
}));
const startTranscription = vi.fn((..._a: unknown[]) => ({ id: 'transcribe-1' }));
vi.mock('../services/transcribeJobs.js', () => ({ startTranscription: (...a: unknown[]) => startTranscription(...a) }));
const startEngineGeneration = vi.fn((..._a: unknown[]) => ({ id: 'cover-1' }));
vi.mock('../services/engineGenJobs.js', () => ({ startEngineGeneration: (...a: unknown[]) => startEngineGeneration(...a) }));
const fetchTranscriptionPreview = vi.fn(async (..._a: unknown[]) => new Response('RIFF'));
const measureScore = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
vi.mock('../services/engineTranscribeClient.js', () => ({
  fetchTranscriptionPreview: (...a: unknown[]) => fetchTranscriptionPreview(...a),
  measureScore: (...a: unknown[]) => measureScore(...a),
}));
const jobs: Record<string, unknown> = {
  done: { id: 'done', taskId: 'remote-1', status: 'done', transcription: { hasPreview: true } },
  unrendered: { id: 'unrendered', taskId: 'remote-2', status: 'done', transcription: { hasPreview: false } },
};
vi.mock('../services/jobs.js', () => ({ getJob: (id: string) => jobs[id] }));
const versionRow = vi.fn((_songId: string): { params_json: string } | undefined => undefined);
vi.mock('../db/index.js', () => ({ db: { prepare: () => ({ get: (id: string) => versionRow(id) }) } }));

const { QueueFullError } = await import('../services/genQueue.js');
const { coversRouter } = await import('./engineCovers.js');

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/engines', coversRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/engines`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  for (const fn of [coverReady, startTranscription, startEngineGeneration, fetchTranscriptionPreview, versionRow, measureScore]) fn.mockClear();
  coverReady.mockImplementation(async () => true);
});

function transcribe(id: string, withFile = true, label?: string) {
  const form = new FormData();
  if (withFile) form.append('src_audio', new Blob([new Uint8Array([1, 2, 3])]), 'ellies.wav');
  if (label) form.append('source_label', label);
  return fetch(`${base}/${id}/transcribe`, { method: 'POST', body: form });
}
const cover = (id: string, body: unknown) =>
  fetch(`${base}/${id}/cover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/engines/:id/transcribe', () => {
  it('starts a transcription of the upload, labelled by the source', async () => {
    const res = await transcribe('yue2', true, 'Ellies City 2');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'transcribe-1' });
    const [engine, source] = startTranscription.mock.calls[0] as [unknown, { data: Buffer; filename: string; label: string }];
    expect(engine).toBe(yue);
    expect({ ...source, data: [...source.data] }).toEqual({ data: [1, 2, 3], filename: 'ellies.wav', label: 'Ellies City 2' });
    await transcribe('yue2');
    expect((startTranscription.mock.calls[1][1] as { label: string }).label).toBe('ellies.wav');
  });

  it('refuses engines that cannot cover, aren\'t configured or aren\'t set up, and a missing file', async () => {
    expect((await transcribe('nope')).status).toBe(404);
    expect((await transcribe('heartmula')).status).toBe(400);
    expect((await transcribe('offline')).status).toBe(400);
    expect((await transcribe('yue2', false)).status).toBe(400);
    coverReady.mockImplementationOnce(async () => false);
    const res = await transcribe('yue2');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not set up/);
    expect(startTranscription).not.toHaveBeenCalled();
  });

  it('409s while another job holds the lock', async () => {
    startTranscription.mockImplementationOnce(() => { throw new QueueFullError(); });
    expect((await transcribe('yue2')).status).toBe(409);
  });

  it('answers an oversized source with a 413 in JSON, not an HTML 500', async () => {
    const form = new FormData();
    form.append('src_audio', new Blob([new Uint8Array(1024 * 1024 + 1)]), 'tanz.wav');
    const res = await fetch(`${base}/yue2/transcribe`, { method: 'POST', body: form });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'the source is over 1 MB' });
    expect(startTranscription).not.toHaveBeenCalled();
  });

  it('answers an unexpected file field with a 400 in JSON', async () => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array([1])]), 'a.wav');
    const res = await fetch(`${base}/yue2/transcribe`, { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('could not read the upload');
    expect(startTranscription).not.toHaveBeenCalled();
  });
});

describe('GET /api/engines/:id/transcribe/:jobId/preview', () => {
  it('streams the engine\'s preview, forwarding Range and relaying the partial response', async () => {
    fetchTranscriptionPreview.mockResolvedValueOnce(new Response('RI', {
      status: 206, headers: { 'Content-Type': 'audio/wav', 'Content-Range': 'bytes 0-1/4', 'Accept-Ranges': 'bytes' },
    }));
    const res = await fetch(`${base}/yue2/transcribe/done/preview`, { headers: { Range: 'bytes=0-1' } });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1/4');
    expect(await res.text()).toBe('RI');
    expect(fetchTranscriptionPreview).toHaveBeenCalledWith(yue, 'remote-1', 'bytes=0-1', expect.any(AbortSignal));
  });

  it('survives the engine\'s stream breaking mid-body, as when a paused player sits past a timeout', async () => {
    // The body sends a chunk, then errors, which is what a timed-out upstream fetch does.
    // Unhandled, this crashed the whole server (a Readable 'error' with no listener).
    fetchTranscriptionPreview.mockResolvedValueOnce(new Response(new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('RIFF'));
        setTimeout(() => c.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), 20);
      },
    }), { headers: { 'Content-Type': 'audio/wav' } }));
    const res = await fetch(`${base}/yue2/transcribe/done/preview`);
    await res.arrayBuffer().catch(() => {}); // the listener sees a cut-off body, nothing worse
    await new Promise((r) => setTimeout(r, 50));
    expect((await fetch(`${base}/yue2/covers/missing/score`)).status).toBe(404); // still serving
  });

  it('tells the engine to stop once the listener leaves', async () => {
    let upstreamSignal: AbortSignal | undefined;
    fetchTranscriptionPreview.mockImplementationOnce(async (...a: unknown[]) => {
      upstreamSignal = a[3] as AbortSignal;
      return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('RIFF')); } }));
    });
    const listener = new AbortController();
    const res = await fetch(`${base}/yue2/transcribe/done/preview`, { signal: listener.signal });
    await res.body!.getReader().read();
    listener.abort();
    await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
  });

  it('404s without a preview, or once the engine no longer has it', async () => {
    expect((await fetch(`${base}/yue2/transcribe/unrendered/preview`)).status).toBe(404);
    expect((await fetch(`${base}/yue2/transcribe/unknown/preview`)).status).toBe(404);
    fetchTranscriptionPreview.mockResolvedValueOnce(new Response('gone', { status: 404 }));
    expect((await fetch(`${base}/yue2/transcribe/done/preview`)).status).toBe(404);
  });
});

describe('POST /api/engines/:id/cover', () => {
  it('starts a cover of the score as a new song, with the Create fields and the source', async () => {
    const res = await cover('yue2', { title: 'Folk Ellies', folder_id: 'f1', prompt: 'folk', lyrics: 'la', seed: 7, abc: 'X:1\n', source: 'Ellies City 2' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: 'cover-1' });
    expect(startEngineGeneration).toHaveBeenCalledWith(
      yue, { prompt: 'folk', lyrics: 'la', seed: 7 }, 'Folk Ellies', 'f1', { abc: 'X:1\n', source: 'Ellies City 2' });
  });

  it('needs a non-blank score within 64 KB, on an engine that can cover', async () => {
    expect((await cover('yue2', { prompt: 'p' })).status).toBe(400);
    expect((await cover('yue2', { prompt: 'p', abc: '  ' })).status).toBe(400);
    expect((await cover('yue2', { prompt: 'p', abc: 'x'.repeat(65537) })).status).toBe(400);
    expect((await cover('heartmula', { prompt: 'p', abc: 'X:1' })).status).toBe(400);
    expect(startEngineGeneration).not.toHaveBeenCalled();
  });
});

describe('POST /api/engines/:id/score-size', () => {
  const post = (id: string, body: unknown) => fetch(`${base}/${id}/score-size`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  it("relays the engine's per-section size, or 204 when it can't say", async () => {
    const size = { budget: 4096, header: 73, sections: [{ name: 'intro', tokens: 646 }] };
    measureScore.mockResolvedValueOnce(size);
    const res = await post('yue2', { abc: 'X:1\n% intro\n' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(size);
    expect(measureScore).toHaveBeenCalledWith(yue, 'X:1\n% intro\n');
    expect((await post('yue2', { abc: 'X:1\n' })).status).toBe(204);
  });

  it("passes on the engine's refusal, and needs a score on an engine that can cover", async () => {
    measureScore.mockRejectedValueOnce(new Error("YUE2 score size -> HTTP 422: Not a score in YuE2's native two-voice ABC"));
    const refused = await post('yue2', { abc: 'junk' });
    expect(refused.status).toBe(502);
    expect((await refused.json()).error).toContain('Not a score');
    expect((await post('yue2', { abc: ' ' })).status).toBe(400);
    expect((await post('heartmula', { abc: 'X:1' })).status).toBe(400);
    expect((await post('nope', { abc: 'X:1' })).status).toBe(404);
  });
});

describe('GET /api/engines/:id/covers/:songId/score', () => {
  const params = (p: object) => ({ params_json: JSON.stringify(p) });

  it('returns the score a cover was made from', async () => {
    versionRow.mockReturnValueOnce(params({ engine: 'yue2', task_type: 'cover', request: { abc: 'X:1\nK:Fm\n' } }));
    const res = await fetch(`${base}/yue2/covers/song-1/score`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(await res.text()).toBe('X:1\nK:Fm\n');
    expect(versionRow).toHaveBeenCalledWith('song-1');
  });

  it('404s anything that isn\'t a cover on that engine', async () => {
    versionRow.mockReturnValueOnce(params({ engine: 'yue2', task_type: 'text2music', request: {} }));
    expect((await fetch(`${base}/yue2/covers/s/score`)).status).toBe(404);
    versionRow.mockReturnValueOnce(params({ task_type: 'cover' })); // an ACE-Step cover
    expect((await fetch(`${base}/yue2/covers/s/score`)).status).toBe(404);
    expect((await fetch(`${base}/yue2/covers/missing/score`)).status).toBe(404);
  });
});
