import { describe, it, expect, afterEach } from 'vitest';
import { startFakeOllama, type FakeOllama } from '../../../test-fakes/fakeOllama.js';
import { loadedModels, probePlanner, releaseModels, releasePlanner, waitUnloaded, UNLOAD_BOUND_MS, UNLOAD_POLL_MS } from './ollamaControl.js';

let fake: FakeOllama;
afterEach(async () => { await fake?.close(); });

/** A clock the sleeps advance, so the 250 ms / 10 s timing is checked without waiting. */
function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return { sleeps, now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; } };
}

async function loadModel(f: FakeOllama) {
  f.chats.push({ content: '{"ops":[]}' });
  await fetch(`${f.url}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ model: 'qwen3:14b', messages: [] }) });
}

describe('releasePlanner (F-020 #1)', () => {
  it('sends keep_alive 0 on the native API, then polls /api/ps every 250 ms until empty', async () => {
    fake = await startFakeOllama({ listedPolls: 3 });
    await loadModel(fake);
    const clock = fakeClock();
    const out = await releasePlanner({ url: fake.url, model: 'qwen3:14b' }, clock);
    const unload = fake.requests.find((r) => r.path === '/api/generate');
    expect(unload).toMatchObject({ method: 'POST', body: { model: 'qwen3:14b', keep_alive: 0 } });
    expect(fake.psPolls()).toHaveLength(4); // listed for 3 polls, empty on the 4th
    expect(clock.sleeps).toEqual([UNLOAD_POLL_MS, UNLOAD_POLL_MS, UNLOAD_POLL_MS]);
    expect(UNLOAD_POLL_MS).toBe(250);
    expect(out).toEqual({ polls: 4, ms: 750 });
    expect(fake.loaded).toBeNull();
  });

  it('ends in an error naming the model and ollama stop after 10 s still listed (F-020 #4)', async () => {
    fake = await startFakeOllama({ neverUnloads: true });
    await loadModel(fake);
    const clock = fakeClock();
    await expect(releasePlanner({ url: fake.url, model: 'qwen3:14b' }, clock))
      .rejects.toThrow("the planner model qwen3:14b is still loaded after 10 s: run 'ollama stop qwen3:14b'");
    expect(UNLOAD_BOUND_MS).toBe(10_000);
    expect(clock.now()).toBe(10_000);
    expect(fake.psPolls()).toHaveLength(41);
  });

  it('releaseModels (D-233): unloads every named model, then waits for /api/ps empty', async () => {
    fake = await startFakeOllama({ models: ['qwen3:14b', 'gemma4:26b-a4b-it-q4_K_M'] });
    for (const model of ['qwen3:14b', 'gemma4:26b-a4b-it-q4_K_M']) {
      fake.chats.push({ content: '{}' });
      await fetch(`${fake.url}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ model, messages: [] }) });
    }
    expect(fake.resident()).toHaveLength(2);
    await releaseModels(fake.url, ['qwen3:14b', 'gemma4:26b-a4b-it-q4_K_M', 'qwen3:14b'], fakeClock());
    expect(fake.requests.filter((r) => r.path === '/api/generate').map((r) => (r.body as { model: string }).model)).toEqual(['qwen3:14b', 'gemma4:26b-a4b-it-q4_K_M']);
    expect(fake.resident()).toEqual([]);
  });

  it('returns at once when nothing is loaded', async () => {
    fake = await startFakeOllama();
    expect(await waitUnloaded({ url: fake.url, model: 'qwen3:14b' }, fakeClock())).toEqual({ polls: 1, ms: 0 });
  });
});

describe('probePlanner (F-020 #5)', () => {
  it('passes an Ollama that has the model', async () => {
    fake = await startFakeOllama();
    expect(await probePlanner({ url: fake.url, model: 'qwen3:14b' })).toBeNull();
  });

  it('reports a server without /api/ps as unsupported, with the reason', async () => {
    fake = await startFakeOllama({ notOllama: true });
    expect(await probePlanner({ url: fake.url, model: 'qwen3:14b' }))
      .toBe(`LLM_API_URL ${fake.url} is not an Ollama server (no /api/ps), so the planner cannot be unloaded before a render: unsupported`);
    await expect(loadedModels({ url: fake.url, model: 'qwen3:14b' })).rejects.toThrow('is not an Ollama server');
  });

  it('names a model that is not pulled, and a server that is gone', async () => {
    fake = await startFakeOllama({ models: ['gemma4:26b'] });
    expect(await probePlanner({ url: fake.url, model: 'qwen3:14b' })).toBe("model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'");
    const url = fake.url;
    await fake.close();
    expect(await probePlanner({ url, model: 'qwen3:14b' })).toMatch(/^planner offline: no answer from/);
  });
});

describe('loadedModels', () => {
  it('reads name and context_length from /api/ps', async () => {
    fake = await startFakeOllama({ contextLength: 2048 });
    await loadModel(fake);
    expect(await loadedModels({ url: fake.url, model: 'qwen3:14b' })).toEqual([{ name: 'qwen3:14b', contextLength: 2048 }]);
  });
});
