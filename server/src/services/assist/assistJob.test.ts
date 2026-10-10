import { describe, expect, it, vi } from 'vitest';
import type { Job } from '../jobRegistry.js';
import { runAssist, type AssistDeps } from './assistJob.js';
import type { AssistRequest } from './assistPrompt.js';

const REQ: AssistRequest = {
  kind: 'repaint', songId: 's1', caption: 'EDM', bpm: 128, key: null, layers: ['Base'], layer: 'Base', part: 'VERSE 2', current: '', ask: '',
};
const reply = (suggestions: unknown) => ({ content: JSON.stringify({ suggestions }), promptTokens: 100 });

function deps(over: Partial<AssistDeps> = {}): AssistDeps & { release: ReturnType<typeof vi.fn>; ask: ReturnType<typeof vi.fn> } {
  return {
    planner: { url: 'http://llm', model: 'qwen3:14b' },
    probe: vi.fn(async () => null),
    ask: vi.fn(async () => reply([{ text: 'darker pads, half-time drums', why: 'more weight' }])),
    loaded: vi.fn(async () => []),
    release: vi.fn(async () => undefined),
    lyricsModel: (lang: string) => (lang === 'de' ? 'gemma4:26b' : 'qwen3:14b'),
    detect: vi.fn(async () => null),
    ...over,
  } as never;
}
const job = (): Job => ({ id: 'j', taskId: '', status: 'running', createdAt: 0 });

describe('runAssist', () => {
  it('asks the planner, keeps the suggestions on the job, and releases the planner before the slot frees', async () => {
    const d = deps();
    const j = job();
    await runAssist(j, REQ, d, new AbortController().signal);
    expect(j).toMatchObject({ status: 'done', assist: { suggestions: [{ text: 'darker pads, half-time drums', why: 'more weight' }] } });
    expect(d.ask.mock.calls[0][4]).toBe('qwen3:14b');
    expect(d.release).toHaveBeenLastCalledWith(['qwen3:14b'], undefined);
  });

  it('German words go to the German lyrics model; both models are released at the end', async () => {
    const words = '[Vers]\nIch geh allein durch die Nacht\nDie Stadt ist wach';
    const d = deps({
      detect: vi.fn(async () => 'de'),
      ask: vi.fn(async () => reply([{ text: '[Vers]\nIch lauf allein durch die Nacht\nDie Stadt erwacht', why: 'reimt' }])),
    });
    const j = job();
    await runAssist(j, { ...REQ, kind: 'lyrics', current: words }, d, new AbortController().signal);
    expect(d.ask.mock.calls[0][4]).toBe('gemma4:26b');
    expect(d.release).toHaveBeenLastCalledWith(['qwen3:14b', 'gemma4:26b'], undefined);
    expect(j.status).toBe('done');
  });

  it('a failed call still releases the model before the job fails', async () => {
    const d = deps({ ask: vi.fn(async () => { throw new Error('planner offline'); }) });
    await expect(runAssist(job(), REQ, d, new AbortController().signal)).rejects.toThrow('planner offline');
    expect(d.release).toHaveBeenCalledWith(['qwen3:14b'], undefined);
  });

  it('no usable suggestion fails the job with what to do', async () => {
    const d = deps({ ask: vi.fn(async () => ({ content: 'not json', promptTokens: 10 })) });
    await expect(runAssist(job(), REQ, d, new AbortController().signal)).rejects.toThrow(/no usable suggestion/);
    expect(d.release).toHaveBeenCalled();
  });

  it('a planner that is not ready fails before anything loads', async () => {
    const d = deps({ probe: vi.fn(async () => "model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'") });
    await expect(runAssist(job(), REQ, d, new AbortController().signal)).rejects.toThrow(/ollama pull/);
    expect(d.ask).not.toHaveBeenCalled();
  });
});
