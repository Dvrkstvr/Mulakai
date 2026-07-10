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
