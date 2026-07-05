import { describe, it, expect, vi, afterEach } from 'vitest';

const { releaseTask } = await import('./acestep.js');

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data, code: 200, error: null }), { status: 200 });
}

describe('releaseTask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a plain JSON body when no files are given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ task_id: 't1' }));
    await releaseTask({ prompt: 'test' });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers as Record<string, string>).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify({ prompt: 'test' }));
  });

  it('builds multipart form with only src_audio when no reference audio is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ task_id: 't2' }));
    await releaseTask({ prompt: 'test' }, { srcAudio: { data: Buffer.from('src'), filename: 'src.mp3' } });
    const [, init] = fetchSpy.mock.calls[0];
    const form = init?.body as FormData;
    expect(form.get('src_audio')).toBeInstanceOf(Blob);
    expect(form.get('reference_audio')).toBeNull();
    expect(form.get('prompt')).toBe('test');
  });

  it('builds multipart form with both src_audio and reference_audio when both are given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ task_id: 't3' }));
    await releaseTask(
      { prompt: 'test' },
      {
        srcAudio: { data: Buffer.from('src'), filename: 'src.mp3' },
        referenceAudio: { data: Buffer.from('ref'), filename: 'voice.mp3' },
      },
    );
    const [, init] = fetchSpy.mock.calls[0];
    const form = init?.body as FormData;
    expect(form.get('src_audio')).toBeInstanceOf(Blob);
    expect(form.get('reference_audio')).toBeInstanceOf(Blob);
  });

  it('builds multipart form with only reference_audio when no src audio is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ task_id: 't4' }));
    await releaseTask({ prompt: 'test' }, { referenceAudio: { data: Buffer.from('ref'), filename: 'voice.mp3' } });
    const [, init] = fetchSpy.mock.calls[0];
    const form = init?.body as FormData;
    expect(form.get('src_audio')).toBeNull();
    expect(form.get('reference_audio')).toBeInstanceOf(Blob);
  });
});
