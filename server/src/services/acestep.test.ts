import { describe, it, expect, vi, afterEach } from 'vitest';

process.env.ACESTEP_API_URL = 'http://acestep.test';

function mockFetchOnce(data: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data, code: 200, error: null }), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createRandomSample', () => {
  it('normalizes simple_mode (description/instrumental/vocal_language, no lyrics/bpm)', async () => {
    mockFetchOnce({ description: 'a soft ballad', instrumental: false, vocal_language: 'bn' });
    const { createRandomSample } = await import('./acestep.js');

    const result = await createRandomSample('simple_mode');

    expect(result).toEqual({ caption: 'a soft ballad', lyrics: '', vocal_language: 'bn' });
  });

  it('normalizes custom_mode, remapping keyscale/timesignature/language to key_scale/time_signature/vocal_language', async () => {
    mockFetchOnce({
      caption: 'an anime battle theme',
      lyrics: '[Verse 1]\n...',
      bpm: 100,
      duration: 160,
      keyscale: 'B minor',
      language: 'zh',
      timesignature: '4',
    });
    const { createRandomSample } = await import('./acestep.js');

    const result = await createRandomSample('custom_mode');

    expect(result).toEqual({
      caption: 'an anime battle theme',
      lyrics: '[Verse 1]\n...',
      bpm: 100,
      key_scale: 'B minor',
      time_signature: '4',
      duration: 160,
      vocal_language: 'zh',
    });
  });
});

describe('queryResult', () => {
  it('passes through progress_text and each result row\'s progress/stage fields', async () => {
    mockFetchOnce([
      {
        task_id: 'task-1',
        status: 0,
        result: JSON.stringify([{ file: '', status: 0, prompt: '', lyrics: '', metas: {}, seed_value: '', progress: 0.37, stage: 'sampling' }]),
        progress_text: 'step 18/50',
      },
    ]);
    const { queryResult } = await import('./acestep.js');

    const [row] = await queryResult(['task-1']);

    expect(row.progress_text).toBe('step 18/50');
    expect(row.result[0]).toMatchObject({ progress: 0.37, stage: 'sampling' });
  });
});

describe('call() non-2xx error handling', () => {
  it('surfaces a FastAPI HTTPException {"detail": ...} body instead of a bare HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'LLM not initialized... set ACESTEP_INIT_LLM=true' }), { status: 503 })),
    );
    const { createRandomSample } = await import('./acestep.js');

    await expect(createRandomSample('simple_mode')).rejects.toThrow(/LLM not initialized/);
  });

  it('prefers an {"error": ...} body over "detail" when both happen to be present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'DiT model not initialized', detail: 'ignored' }), { status: 503 })),
    );
    const { createRandomSample } = await import('./acestep.js');

    await expect(createRandomSample('simple_mode')).rejects.toThrow(/DiT model not initialized/);
  });

  it('falls back to a bare HTTP status when the non-2xx body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 500 })),
    );
    const { createRandomSample } = await import('./acestep.js');

    await expect(createRandomSample('simple_mode')).rejects.toThrow(/HTTP 500/);
  });
});

describe('analyzeAudio', () => {
  it('posts multipart form-data with field name "audio" and remaps keyscale/timesignature/language', async () => {
    let capturedBody: FormData | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = init?.body as FormData;
        return new Response(
          JSON.stringify({
            data: {
              caption: 'a driving synthwave track', bpm: 143, keyscale: 'D minor',
              duration: 77, timesignature: '4', language: 'unknown',
            },
            code: 200, error: null,
          }),
          { status: 200 },
        );
      }),
    );
    const { analyzeAudio } = await import('./acestep.js');

    const result = await analyzeAudio({ data: Buffer.from('fake-audio-bytes'), filename: 'source.wav' });

    expect(result).toEqual({
      caption: 'a driving synthwave track', lyrics: '', bpm: 143, key_scale: 'D minor',
      time_signature: '4', duration: 77, vocal_language: 'unknown',
    });
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody?.get('audio')).toBeTruthy();
  });

  it('loads the given model + LM via /v1/init before calling /v1/analyze_audio', async () => {
    const calledUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calledUrls.push(url);
        if (url.endsWith('/v1/init')) {
          return new Response(JSON.stringify({ data: {}, code: 200, error: null }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ data: { caption: 'a track' }, code: 200, error: null }),
          { status: 200 },
        );
      }),
    );
    const { analyzeAudio } = await import('./acestep.js');

    await analyzeAudio({ data: Buffer.from('fake-audio-bytes'), filename: 'source.wav' }, 'acestep-xl-sft');

    expect(calledUrls).toEqual(['http://acestep.test/v1/init', 'http://acestep.test/v1/analyze_audio']);
  });

  it('skips /v1/init when no model is given', async () => {
    const calledUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calledUrls.push(url);
        return new Response(JSON.stringify({ data: { caption: 'a track' }, code: 200, error: null }), { status: 200 });
      }),
    );
    const { analyzeAudio } = await import('./acestep.js');

    await analyzeAudio({ data: Buffer.from('fake-audio-bytes'), filename: 'source.wav' });

    expect(calledUrls).toEqual(['http://acestep.test/v1/analyze_audio']);
  });
});

describe('createSampleFromQuery', () => {
  it('sends query/instrumental/vocal_language/temperature and remaps keyscale/timesignature', async () => {
    mockFetchOnce({
      caption: 'a melancholic indie rock ballad',
      lyrics: '[Intro]\n...',
      bpm: 77,
      keyscale: 'D major',
      duration: 238,
      timesignature: '4',
      vocal_language: 'tl',
    });
    const { createSampleFromQuery } = await import('./acestep.js');

    const result = await createSampleFromQuery({ query: 'sad indie rock ballad with reverb' });

    expect(result).toEqual({
      caption: 'a melancholic indie rock ballad',
      lyrics: '[Intro]\n...',
      bpm: 77,
      key_scale: 'D major',
      time_signature: '4',
      duration: 238,
      vocal_language: 'tl',
    });
  });
});

describe('adapter lifecycle', () => {
  /** Captures the request so the body/method/URL can be asserted, not just the result. */
  function captureFetch(response: Response) {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return response;
    }));
    return calls;
  }

  const envelope = (data: unknown, code = 200, error: string | null = null) =>
    new Response(JSON.stringify({ data, code, error }), { status: 200 });

  it('posts lora_path to /v1/lora/load', async () => {
    const calls = captureFetch(envelope({ message: 'ok', lora_path: '/models/acid' }));
    const { loadLora } = await import('./acestep.js');

    await loadLora('/models/acid');

    expect(calls[0].url).toBe('http://acestep.test/v1/lora/load');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ lora_path: '/models/acid' });
  });

  it('reads status with a GET and remaps ACE-Step\'s field names', async () => {
    const calls = captureFetch(envelope({
      lora_loaded: true, use_lora: true, lora_scale: 0.7, adapter_type: 'lokr',
    }));
    const { loraStatus } = await import('./acestep.js');

    const status = await loraStatus();

    expect(calls[0].init?.method).toBeUndefined(); // no method = GET
    expect(status).toEqual({ loaded: true, active: true, scale: 0.7, adapterType: 'lokr' });
  });

  it('surfaces the code=400 envelope /toggle and /scale return instead of raising', async () => {
    // These two routes answer HTTP 200 with an error envelope, unlike /load and /unload.
    captureFetch(envelope(null, 400, 'No LoRA adapter loaded. Please load a LoRA first.'));
    const { toggleLora } = await import('./acestep.js');

    await expect(toggleLora(true)).rejects.toThrow('No LoRA adapter loaded');
  });

  it('surfaces the bare {detail} body /load raises as a real HTTPException', async () => {
    captureFetch(new Response(JSON.stringify({ detail: 'Model not initialized' }), { status: 500 }));
    const { loadLora } = await import('./acestep.js');

    await expect(loadLora('/models/acid')).rejects.toThrow('Model not initialized');
  });

  it('bumps the model generation on init, so adapter state knows it was dropped', async () => {
    captureFetch(envelope({ slot: 1, loaded_model: 'acestep-v15-base' }));
    const { initModel, getModelGeneration } = await import('./acestep.js');
    const before = getModelGeneration();

    await initModel({ model: 'acestep-v15-base' });

    expect(getModelGeneration()).toBe(before + 1);
  });
});

describe('releaseTask', () => {
  it('strips our own params (output, adapter) from the wire — ACE-Step has no such fields', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { task_id: 't1' }, code: 200, error: null }), { status: 200 });
    }));
    const { releaseTask } = await import('./acestep.js');

    await releaseTask({
      task_type: 'text2music',
      prompt: 'a driving synthwave track',
      adapter: { name: 'Acid House', scale: 0.6 },
      output: { format: 'wav' },
    });

    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.prompt).toBe('a driving synthwave track');
    expect(body.adapter).toBeUndefined();
    expect(body.output).toBeUndefined();
  });
});
