import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api.randomSample', () => {
  it('posts sample_type and returns the parsed result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ caption: 'c', lyrics: 'l' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.randomSample('custom_mode');

    expect(fetchMock).toHaveBeenCalledWith('/api/generate/random-sample', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ sample_type: 'custom_mode' }),
    }));
    expect(result).toEqual({ caption: 'c', lyrics: 'l' });
  });

  it('defaults to custom_mode (the only mode with lyrics/bpm/key/duration)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ caption: '', lyrics: '' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.randomSample();

    expect(fetchMock).toHaveBeenCalledWith('/api/generate/random-sample', expect.objectContaining({
      body: JSON.stringify({ sample_type: 'custom_mode' }),
    }));
  });
});

describe('api.importSong', () => {
  it('posts the file as multipart with the fields alongside it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 's1', title: 'My Track' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['audio bytes'], 'My Track.mp3', { type: 'audio/mpeg' });
    const song = await api.importSong(file, { title: 'My Track', duration: '212.5' });

    expect(song.id).toBe('s1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/songs/import');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect(form.get('title')).toBe('My Track');
    expect(form.get('duration')).toBe('212.5');
    // The File's own name must survive: the server reads the extension off it (allowlisted)
    // and uses it as the title fallback.
    expect((form.get('audio') as File).name).toBe('My Track.mp3');
    // No Content-Type header — the browser has to set the multipart boundary itself.
    expect(init.headers).toBeUndefined();
  });

  it('sends just the file when there are no fields to carry', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 's2' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.importSong(new File(['x'], 'bare.wav'));

    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect([...form.keys()]).toEqual(['audio']);
  });
});

describe('api.sampleFromQuery', () => {
  it('posts the query and returns the parsed result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ caption: 'about rain', lyrics: '' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.sampleFromQuery('a rainy day song');

    expect(fetchMock).toHaveBeenCalledWith('/api/generate/sample-from-query', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: 'a rainy day song' }),
    }));
    expect(result.caption).toBe('about rain');
  });

  it('surfaces the server error message on failure', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'query is required' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.sampleFromQuery('')).rejects.toThrow('query is required');
  });
});
