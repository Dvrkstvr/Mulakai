import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Lookup } from './lookup';

const listModels = vi.fn();
const splitHealth = vi.fn();
const listVoices = vi.fn();
vi.mock('./api', () => ({
  api: { listModels: () => listModels(), splitHealth: () => splitHealth(), listVoices: () => listVoices() },
}));

const { lookupRunner, modelsFor, SLOW_LOOKUP_MS } = await import('./lookup');
const { useVoiceStore } = await import('./voiceStore');

const offline = () => Promise.reject(new TypeError('Failed to fetch'));

/** Runs a lookup once and returns every state it set, in order. */
async function run<T>(load: () => Promise<T>): Promise<Lookup<T>[]> {
  const states: Lookup<T>[] = [];
  await lookupRunner(load, (s) => states.push(s))();
  return states;
}

describe('lookupRunner', () => {
  it('goes from loading to the answer', async () => {
    expect(await run(() => Promise.resolve(['xl-base']))).toEqual([
      { data: null, error: '' },
      { data: ['xl-base'], error: '' },
    ]);
  });

  it('reports a failure as an error with no data, instead of rejecting', async () => {
    expect(await run(offline)).toEqual([
      { data: null, error: '' },
      { data: null, error: 'Failed to fetch' },
    ]);
  });

  it('catches a load that throws synchronously', async () => {
    const states = await run(() => { throw new Error('boom'); });
    expect(states.at(-1)).toEqual({ data: null, error: 'boom' });
  });

  it('clears the error once a retry succeeds', async () => {
    const states: Lookup<string>[] = [];
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('HTTP 502')).mockResolvedValueOnce('ok');
    const retry = lookupRunner(load, (s) => states.push(s));
    await retry();
    await retry();
    expect(states.map((s) => s.error)).toEqual(['', 'HTTP 502', '', '']);
    expect(states.at(-1)?.data).toBe('ok');
  });

  it('says a load is slow once it runs long, then still takes the answer', async () => {
    vi.useFakeTimers();
    try {
      const states: Lookup<string>[] = [];
      let answer!: (v: string) => void;
      const done = lookupRunner(() => new Promise<string>((r) => { answer = r; }), (s) => states.push(s))();
      await vi.advanceTimersByTimeAsync(SLOW_LOOKUP_MS);
      expect(states.at(-1)).toEqual({ data: null, error: '', slow: true });
      answer('ok');
      await done;
      expect(states.at(-1)).toEqual({ data: 'ok', error: '' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('never marks a quick load slow after it lands', async () => {
    vi.useFakeTimers();
    try {
      const states: Lookup<string>[] = [];
      await lookupRunner(() => Promise.resolve('ok'), (s) => states.push(s))();
      await vi.advanceTimersByTimeAsync(SLOW_LOOKUP_MS * 2);
      expect(states.some((s) => s.slow)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a failed lookup isn't an answer", () => {
  beforeEach(() => {
    listModels.mockReset();
    splitHealth.mockReset();
    listVoices.mockReset();
    useVoiceStore.setState({ voices: [] });
  });

  it('models: an unreachable server is an error, not "no model supports it"', async () => {
    listModels.mockImplementation(offline);
    expect((await run(() => modelsFor('lego'))).at(-1)).toEqual({ data: null, error: 'Failed to fetch' });
  });

  it.each(['cover', 'complete'] as const)('models for %s (Create): an unreachable server is an error, not "none"', async (task) => {
    listModels.mockImplementation(offline);
    expect((await run(() => modelsFor(task))).at(-1)).toEqual({ data: null, error: 'Failed to fetch' });
  });

  it('model inventory (Settings, model selects): an unreachable server is an error, not an empty inventory', async () => {
    listModels.mockRejectedValue(new Error('HTTP 502'));
    expect((await run(() => listModels())).at(-1)).toEqual({ data: null, error: 'HTTP 502' });
  });

  it('models: a server that answers with none still gates the control', async () => {
    listModels.mockResolvedValue({ models: [{ name: 'xl-turbo', supportedTaskTypes: ['text2music'] }], lmModels: [], defaultModel: null });
    expect((await run(() => modelsFor('lego'))).at(-1)).toEqual({ data: [], error: '' });
  });

  it('split health: an unreachable server is an error, not "Demucs is not configured"', async () => {
    splitHealth.mockImplementation(offline);
    expect((await run(() => splitHealth())).at(-1)).toEqual({ data: null, error: 'Failed to fetch' });
  });

  it('voices: a failed fetch is reported, not an unhandled rejection', async () => {
    listVoices.mockRejectedValue(new Error('HTTP 502'));
    const states = await run(useVoiceStore.getState().fetchVoices);
    expect(states.at(-1)?.error).toBe('HTTP 502');
    expect(useVoiceStore.getState().voices).toEqual([]);
  });
});
