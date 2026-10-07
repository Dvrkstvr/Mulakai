import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => vi.unstubAllGlobals());

const {
  transcribe, transcriptionStatus, transcriptionHealth, fetchTranscriptionScore, fetchTranscriptionPreview,
  cancelTranscription, measureScore,
} = await import('./engineTranscribeClient.js');

const target = { label: 'YUE2', url: 'http://127.0.0.1:8004', apiKey: 'secret' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => fetchMock.mockReset());

describe('engine transcription client', () => {
  it('posts the audio as multipart under our job id, with the bearer key', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'remote-1', kind: 'transcription' }, 202));
    expect(await transcribe(target, Buffer.from('RIFF'), 'ellies.wav', 'job-9')).toBe('remote-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8004/v1/transcriptions');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret', 'Idempotency-Key': 'job-9' });
    const file = (init?.body as FormData).get('audio') as File;
    expect(file.name).toBe('ellies.wav');
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe('RIFF');
  });

  it("asks for chords only when told to (D-131): Guided Create's COVER sends no field", async () => {
    fetchMock.mockImplementation(async () => json({ id: 'remote-2' }, 202));
    await transcribe(target, Buffer.from('x'), 'a.wav', 'j1');
    expect((fetchMock.mock.calls[0][1]?.body as FormData).has('chords')).toBe(false);
    await transcribe(target, Buffer.from('x'), 'a.wav', 'j2', { chords: true });
    expect((fetchMock.mock.calls[1][1]?.body as FormData).get('chords')).toBe('true');
  });

  it('reports the wrapper\'s refusal with its detail', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'Transcription is not available: not_configured.' }, 503));
    await expect(transcribe(target, Buffer.from('x'), 'a.wav', 'j')).rejects.toThrow(
      'YUE2 transcribe -> HTTP 503: Transcription is not available: not_configured.');
  });

  it('maps statuses, progress and the finished facts', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'running', stage: 'transcribing', progress: 0.5 }));
    expect(await transcriptionStatus(target, 'r1')).toEqual({ state: 'running', stage: 'transcribing', progress: 0.5 });
    fetchMock.mockResolvedValueOnce(json({
      status: 'succeeded', stage: 'finished',
      result: { score_url: '/s', preview_url: null, warnings: ['short clip'], measures: 44, vocal_notes: 167,
        instrumental_notes: 16, duration_seconds: 140 },
    }));
    expect(await transcriptionStatus(target, 'r1')).toEqual({ state: 'done', stage: 'finished', facts: {
      warnings: ['short clip'], measures: 44, vocalNotes: 167, instrumentalNotes: 16, durationSeconds: 140, hasPreview: false,
      sectionStarts: null,
    } });
    fetchMock.mockResolvedValueOnce(json({ status: 'failed', error: { code: 'no_score', message: 'SheetSage2 built no score' } }));
    expect(await transcriptionStatus(target, 'r1')).toEqual({ state: 'failed', error: 'SheetSage2 built no score' });
    fetchMock.mockResolvedValueOnce(json({ status: 'cancelled' }));
    expect((await transcriptionStatus(target, 'r1')).state).toBe('failed');
    fetchMock.mockResolvedValueOnce(json({ status: 'exploded' }));
    expect(await transcriptionStatus(target, 'r1')).toMatchObject({ state: 'failed', error: expect.stringContaining('unknown status') });
  });

  it("maps the score's section start times, dropping malformed entries", async () => {
    fetchMock.mockResolvedValueOnce(json({
      status: 'succeeded',
      result: { section_starts: [
        { label: 'intro', bar: 0, seconds: 0.01 }, { label: 'verse', bar: 4, seconds: 12.85 },
        { label: 'chorus', bar: 'twelve', seconds: 38.45 }, { bar: 18, seconds: 57.65 }, null,
      ] },
    }));
    const state = await transcriptionStatus(target, 'r1');
    expect(state.facts?.sectionStarts).toEqual([
      { label: 'intro', bar: 0, seconds: 0.01 }, { label: 'verse', bar: 4, seconds: 12.85 },
    ]);
    fetchMock.mockResolvedValueOnce(json({ status: 'succeeded', result: { section_starts: null } }));
    expect((await transcriptionStatus(target, 'r1')).facts?.sectionStarts).toBeNull();
  });

  it('reads the score, forwards Range for the preview, and cancels without throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response('X:1\n'));
    expect(await fetchTranscriptionScore(target, 'r1')).toBe('X:1\n');
    fetchMock.mockResolvedValueOnce(new Response('RIFF', { status: 206 }));
    const signal = new AbortController().signal;
    expect((await fetchTranscriptionPreview(target, 'r1', 'bytes=0-3', signal)).status).toBe(206);
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8004/v1/transcriptions/r1/preview');
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Range: 'bytes=0-3' });
    // The caller's signal, not a whole-request timeout: a paused player keeps the body open.
    expect(fetchMock.mock.calls[1][1]?.signal).toBe(signal);
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(cancelTranscription(target, 'r1')).resolves.toBeUndefined();
  });

  it('is healthy only on a 200 from the transcription health route', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'ready' }));
    expect(await transcriptionHealth(target)).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8004/v1/transcriptions/health');
    fetchMock.mockResolvedValueOnce(json({ status: 'not_configured' }, 503));
    expect(await transcriptionHealth(target)).toBe(false);
    fetchMock.mockResolvedValueOnce(json({ detail: 'Not Found' }, 404)); // a yue2-serve backend
    expect(await transcriptionHealth(target)).toBe(false);
    expect(await transcriptionHealth({ ...target, url: '' })).toBe(false);
  });

  it('sizes a score per section, and says nothing for a backend without the route', async () => {
    fetchMock.mockResolvedValueOnce(json({ budget: 4096, header: 73, sections: [{ name: 'intro', tokens: 646 }] }));
    expect(await measureScore(target, 'X:1\n% intro\n')).toEqual({ budget: 4096, header: 73, sections: [{ name: 'intro', tokens: 646 }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8004/v1/scores/measure');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ abc: 'X:1\n% intro\n' }) });
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });

    fetchMock.mockResolvedValueOnce(json({ detail: 'Not Found' }, 404));
    expect(await measureScore(target, 'X:1\n')).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ detail: "Not a score in YuE2's native two-voice ABC: bad" }, 422));
    await expect(measureScore(target, 'junk')).rejects.toThrow('YUE2 score size -> HTTP 422: Not a score');
    fetchMock.mockResolvedValueOnce(json({ budget: 4096, header: 1, sections: [{ name: 'intro' }] }));
    await expect(measureScore(target, 'X:1\n')).rejects.toThrow('unreadable reply');
  });
});
