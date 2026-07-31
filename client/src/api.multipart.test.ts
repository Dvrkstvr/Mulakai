import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { api } = await import('./api');

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const sentForm = (): FormData => fetchMock.mock.calls[0][1].body as FormData;

describe('multipart param serialization', () => {
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(ok({ jobId: 'j1' }));
  });

  it('JSON-encodes the output settings object instead of "[object Object]"', async () => {
    const output = { format: 'wav', sampleRate: 44100, bitDepth: 16, mp3Bitrate: 320 };
    await api.generate({ title: 't', prompt: 'p', output }, new Blob(['ref']));

    expect(sentForm().get('output')).toBe(JSON.stringify(output));
  });

  it('sends booleans as "true"/"false" strings the server decodes', async () => {
    await api.generate(
      { title: 't', prompt: 'p', thinking: false, use_random_seed: false, seed: 7 },
      new Blob(['ref']),
    );

    const form = sentForm();
    expect(form.get('thinking')).toBe('false');
    expect(form.get('use_random_seed')).toBe('false');
    expect(form.get('seed')).toBe('7');
  });

  it('applies the same encoding on the add-layer form', async () => {
    const output = { format: 'flac', sampleRate: 48000, bitDepth: 24, mp3Bitrate: 320 };
    await api.addLayer('s1', new Blob(['mix']), { prompt: 'p', layerName: 'Bass', output });

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('output')).toBe(JSON.stringify(output));
  });

  it('omits undefined and null params entirely', async () => {
    await api.generate({ title: 't', prompt: 'p', lyrics: undefined, model: null as unknown as string }, new Blob(['ref']));

    const form = sentForm();
    expect(form.has('lyrics')).toBe(false);
    expect(form.has('model')).toBe(false);
  });
});
