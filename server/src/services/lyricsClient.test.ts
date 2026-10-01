import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

process.env.LYRICS_API_URL = 'http://127.0.0.1:8005';
const { lyricsHealth, transcribeLyrics } = await import('./lyricsClient.js');

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => fetchMock.mockReset());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const word = (text: string, start: number) => ({ text, start, end: start + 0.5 });

describe('lyricsHealth', () => {
  it('is true on a 200 and false when unset, failing or unreachable', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    expect(await lyricsHealth()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8005/health');

    fetchMock.mockResolvedValueOnce(json({}, 503));
    expect(await lyricsHealth()).toBe(false);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await lyricsHealth()).toBe(false);
    expect(await lyricsHealth('')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('transcribeLyrics', () => {
  it('posts the audio and language as multipart and returns the reading', async () => {
    const segments = [{ text: 'Midnight city', start: 10.26, end: 12.16, words: [word('Midnight', 10.26), word('city', 11.66)] }];
    fetchMock.mockResolvedValueOnce(json({ language: 'en', segments }));

    const reading = await transcribeLyrics(Buffer.from('audio'), 'ellies.wav', 'en');

    expect(reading).toEqual({ language: 'en', segments });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8005/transcribe');
    expect(init?.method).toBe('POST');
    const form = init?.body as FormData;
    expect(form.get('language')).toBe('en');
    expect((form.get('audio') as File).name).toBe('ellies.wav');
  });

  it('drops malformed segments and words but keeps the rest', async () => {
    fetchMock.mockResolvedValueOnce(json({ language: 'de', segments: [
      { text: 'Leg die KI', start: 11.7, end: 15, words: [word('Leg', 11.7), { text: 'die' }] },
      { text: '', start: 20, end: 21 },
      { text: 'kein start', end: 30 },
      { text: 'no words', start: 40, end: 41 },
    ] }));

    const { segments } = await transcribeLyrics(Buffer.from('a'), 'tanz.wav', '');
    expect(segments).toEqual([
      { text: 'Leg die KI', start: 11.7, end: 15, words: [word('Leg', 11.7)] },
      { text: 'no words', start: 40, end: 41, words: [] },
    ]);
  });

  it("surfaces the service's detail on a failed job", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'transcription failed: CUDA out of memory' }, 500));
    await expect(transcribeLyrics(Buffer.from('a'), 'a.wav', '')).rejects.toThrow('lyrics-server transcribe -> transcription failed: CUDA out of memory');
  });

  it('rejects a reply without language and segments', async () => {
    fetchMock.mockResolvedValueOnce(json({ text: 'hello' }));
    await expect(transcribeLyrics(Buffer.from('a'), 'a.wav', '')).rejects.toThrow('unexpected reply');
  });

  it('stops waiting when the caller aborts', async () => {
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')));
    }));
    const abort = new AbortController();
    const pending = transcribeLyrics(Buffer.from('a'), 'a.wav', '', abort.signal);
    abort.abort();
    await expect(pending).rejects.toThrow('aborted');
  });
});
