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
