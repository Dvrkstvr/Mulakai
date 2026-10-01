import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('./acestep.js', () => ({
  listModels: vi.fn(async () => ({ models: [], lmModels: [], defaultModel: null })),
}));

const acestep = await import('./acestep.js');
const { config } = await import('../config.js');
const { splitHealth } = await import('./splitHealth.js');

const extractModel = { name: 'acestep-v15-base', supportedTaskTypes: ['extract' as const] };

beforeEach(() => {
  config.demucsUrl = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('splitHealth — ACE-Step', () => {
  it('is available when a downloaded model supports extract', async () => {
    vi.mocked(acestep.listModels).mockResolvedValueOnce({ models: [extractModel], lmModels: [], defaultModel: null });
    expect(await splitHealth()).toMatchObject({ acestep: true, acestepError: null });
  });

  it('answers "no extract model" only when ACE-Step said so', async () => {
    vi.mocked(acestep.listModels).mockResolvedValueOnce({ models: [], lmModels: [], defaultModel: null });
    expect(await splitHealth()).toMatchObject({ acestep: false, acestepError: null });
  });

  it('reports why when ACE-Step could not be asked', async () => {
    vi.mocked(acestep.listModels).mockRejectedValueOnce(new Error('ACE-Step model inventory -> HTTP 401'));
    expect(await splitHealth()).toMatchObject({ acestep: false, acestepError: 'ACE-Step model inventory -> HTTP 401' });
  });
});

describe('splitHealth — Demucs', () => {
  it('is "unset" without DEMUCS_API_URL, and never probes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await splitHealth()).toMatchObject({ demucs: false, demucsReason: 'unset' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is up when its /health answers 2xx', async () => {
    config.demucsUrl = 'http://demucs.test';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await splitHealth()).toMatchObject({ demucs: true, demucsReason: null });
    expect(fetchMock).toHaveBeenCalledWith('http://demucs.test/health', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('is "unreachable", not "unset", when set but refused', async () => {
    config.demucsUrl = 'http://demucs.test';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await splitHealth()).toMatchObject({ demucs: false, demucsReason: 'unreachable' });
  });

  it('is "unreachable" when its /health answers non-2xx', async () => {
    config.demucsUrl = 'http://demucs.test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await splitHealth()).toMatchObject({ demucs: false, demucsReason: 'unreachable' });
  });

  it('stays usable while ACE-Step is down', async () => {
    config.demucsUrl = 'http://demucs.test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    vi.mocked(acestep.listModels).mockRejectedValueOnce(new Error('ACE-Step unreachable at http://acestep.test (ECONNREFUSED)'));
    expect(await splitHealth()).toEqual({
      acestep: false,
      acestepError: 'ACE-Step unreachable at http://acestep.test (ECONNREFUSED)',
      demucs: true,
      demucsReason: null,
    });
  });
});
