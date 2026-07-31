import { describe, it, expect, vi, afterEach } from 'vitest';

process.env.ACESTEP_API_URL = 'http://acestep.test';
process.env.ACESTEP_TIMEOUT_MS = '100';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch that never responds but respects its AbortSignal — the hung-socket case. */
function stubHungFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      }),
    ),
  );
}

describe('ACE-Step request timeouts', () => {
  it('fails a hung control call with a clear error instead of hanging forever', async () => {
    stubHungFetch();
    const { queryResult } = await import('./acestep.js');

    await expect(queryResult(['task-1'])).rejects.toThrow(/no response within \d+s/);
  });

  it('fails a hung audio download too (at its larger budget)', async () => {
    stubHungFetch();
    const { downloadAudio } = await import('./acestep.js');

    await expect(downloadAudio('/v1/audio?path=x')).rejects.toThrow(/no response within \d+s/);
  });

  it('health() reports down rather than hanging on a dead socket', async () => {
    // health uses a fixed 10s leash — too slow for a unit test to wait out, so just
    // assert the signal is actually passed and a pre-aborted equivalent turns into false.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      }),
    );
    const { health } = await import('./acestep.js');

    await expect(health()).resolves.toBe(false);
  });
});
