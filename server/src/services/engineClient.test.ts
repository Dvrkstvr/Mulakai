import { describe, it, expect, vi, afterEach } from 'vitest';

process.env.ACESTEP_TIMEOUT_MS = '50';

const { health, submit, status, fetchAudio, fetchScore, cancel } = await import('./engineClient.js');

const target = { label: 'YUE2', url: 'http://127.0.0.1:9000', apiKey: '' };
const keyed = { ...target, apiKey: 'secret-key-0123456789' };

function mockFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => respond(String(url), init ?? {}));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

afterEach(() => vi.unstubAllGlobals());

describe('auth', () => {
  it('sends no Authorization header without a key', async () => {
    const fn = mockFetch(() => json({ id: 'w1', status: 'queued' }, { status: 202 }));
    await submit(target, {}, 'job-1');
    expect(headerOf(fn.mock.calls[0][1] as RequestInit, 'Authorization')).toBeUndefined();
  });

  it('sends the bearer header on every call once a key is set', async () => {
    const fn = mockFetch((url) => (url.endsWith('/audio') ? new Response('flac') : json({ id: 'w1', status: 'running' })));
    await submit(keyed, {}, 'job-1');
    await status(keyed, 'w1');
    await fetchAudio(keyed, 'w1');
    await cancel(keyed, 'w1');
    await health(keyed);
    for (const [, init] of fn.mock.calls) {
      expect(headerOf(init as RequestInit, 'Authorization')).toBe('Bearer secret-key-0123456789');
    }
  });
});

describe('submit', () => {
  it('posts the body as JSON with our job id as the Idempotency-Key, and returns the wrapper id', async () => {
    const fn = mockFetch(() => json({ id: 'wrapper-7', status: 'queued', stage: 'queued' }, { status: 202 }));
    const id = await submit(target, { style: 'pop', lyrics: '[Verse]\nla' }, 'job-abc');
    expect(id).toBe('wrapper-7');
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:9000/v1/jobs');
    expect(init.method).toBe('POST');
    expect(headerOf(init, 'Idempotency-Key')).toBe('job-abc');
    expect(JSON.parse(init.body as string)).toEqual({ style: 'pop', lyrics: '[Verse]\nla' });
  });

  it('accepts an idempotent replay (200) the same as a 202', async () => {
    mockFetch(() => json({ id: 'wrapper-7' }));
    await expect(submit(target, {}, 'job-abc')).resolves.toBe('wrapper-7');
  });

  it("surfaces FastAPI's detail string for a refusal", async () => {
    mockFetch(() => json({ detail: 'Queue is full' }, { status: 429 }));
    await expect(submit(target, {}, 'j')).rejects.toThrow('YUE2 submit -> HTTP 429: Queue is full');
  });

  it("surfaces the first validation message for a 422", async () => {
    mockFetch(() => json({ detail: [{ msg: 'Extra inputs are not permitted' }] }, { status: 422 }));
    await expect(submit(target, {}, 'j')).rejects.toThrow('HTTP 422: Extra inputs are not permitted');
  });

  it('fails when the reply has no job id', async () => {
    mockFetch(() => json({ status: 'queued' }, { status: 202 }));
    await expect(submit(target, {}, 'j')).rejects.toThrow('no job id');
  });

  it('names the engine when the wrapper is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(submit(target, {}, 'j')).rejects.toThrow('YUE2 submit -> fetch failed');
  });
});

describe('status mapping', () => {
  const cases: Array<[unknown, { state: string; truncated: boolean }]> = [
    ['queued', { state: 'running', truncated: false }],
    ['running', { state: 'running', truncated: false }],
    ['succeeded', { state: 'done', truncated: false }],
    ['truncated', { state: 'done', truncated: true }],
    ['failed', { state: 'failed', truncated: false }],
    ['cancelled', { state: 'failed', truncated: false }],
  ];
  it.each(cases)('%s', async (wire, expected) => {
    mockFetch(() => json({ id: 'w1', status: wire }));
    expect(await status(target, 'w1')).toMatchObject(expected);
  });

  it('passes progress and stage through while running', async () => {
    mockFetch(() => json({ id: 'w1', status: 'running', stage: 'semantic', progress: 0.4 }));
    expect(await status(target, 'w1')).toEqual({ state: 'running', truncated: false, stage: 'semantic', progress: 0.4 });
  });

  it("reads yue2-serve's { code, message } error object", async () => {
    mockFetch(() => json({ id: 'w1', status: 'failed', error: { code: 'oom', message: 'CUDA out of memory' } }));
    expect((await status(target, 'w1')).error).toBe('CUDA out of memory');
  });

  it('reads a plain string error', async () => {
    mockFetch(() => json({ id: 'w1', status: 'failed', error: 'boom' }));
    expect((await status(target, 'w1')).error).toBe('boom');
  });

  it('fails an unknown status instead of polling it forever', async () => {
    mockFetch(() => json({ id: 'w1', status: 'partial_failed' }));
    expect(await status(target, 'w1')).toMatchObject({ state: 'failed', error: expect.stringContaining('partial_failed') });
  });

  it('throws on a non-2xx status reply, so the poll loop can count a strike', async () => {
    mockFetch(() => json({ detail: 'Job not found' }, { status: 404 }));
    await expect(status(target, 'w1')).rejects.toThrow('HTTP 404: Job not found');
  });
});

describe('timeouts', () => {
  it('turns a hung request into an error naming the engine and the call', async () => {
    mockFetch((_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
    }));
    await expect(status(target, 'w1')).rejects.toThrow('YUE2 status -> no response within');
  });
});

describe('artifacts', () => {
  it('downloads the audio bytes', async () => {
    mockFetch(() => new Response(Buffer.from('fLaC-bytes')));
    expect((await fetchAudio(target, 'w1')).toString()).toBe('fLaC-bytes');
  });

  it('returns the score text, and null for a 404 (the engine has none)', async () => {
    mockFetch(() => new Response('X:1\nK:C\n'));
    expect(await fetchScore(target, 'w1')).toBe('X:1\nK:C\n');
    mockFetch(() => json({ detail: 'Artifact not found' }, { status: 404 }));
    expect(await fetchScore(target, 'w1')).toBeNull();
  });

  it('throws for any other score failure', async () => {
    mockFetch(() => json({ detail: 'Artifact is not available for this job state' }, { status: 409 }));
    await expect(fetchScore(target, 'w1')).rejects.toThrow('HTTP 409');
  });
});

describe('cancel', () => {
  it('posts to the cancel route and swallows any failure', async () => {
    const fn = mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(cancel(target, 'w1')).resolves.toBeUndefined();
    expect(fn.mock.calls[0][0]).toBe('http://127.0.0.1:9000/v1/jobs/w1/cancel');
  });
});

describe('health', () => {
  it('is true only for a 200 from /health/ready', async () => {
    const fn = mockFetch(() => json({ status: 'ready' }));
    expect(await health(target)).toBe(true);
    expect(fn.mock.calls[0][0]).toBe('http://127.0.0.1:9000/health/ready');
  });

  it("is false while yue2-serve is still loading (503)", async () => {
    mockFetch(() => json({ status: 'loading' }, { status: 503 }));
    expect(await health(target)).toBe(false);
  });

  it('is false when the wrapper is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect(await health(target)).toBe(false);
  });

  it('is false without probing when the engine has no URL', async () => {
    const fn = mockFetch(() => json({}));
    expect(await health({ ...target, url: '' })).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
