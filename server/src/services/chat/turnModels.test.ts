/** F-095: a call the turn gave up on (timed out, cancelled) may still be generating in Ollama; the session remembers
 * it and hands it to every later release, which then waits longer for that model to leave (ollamaControl). */
import { describe, it, expect, vi } from 'vitest';
import { CallCut } from '../score/plannerClient.js';
import { modelSession, type ModelControl } from './turnModels.js';

const QWEN = 'qwen3:14b';
const GEMMA = 'gemma4:26b-a4b-it-q4_K_M';
const control = (): ModelControl & { release: ReturnType<typeof vi.fn> } => ({
  probe: async () => null, loaded: async () => [], release: vi.fn(async () => undefined),
});

describe('modelSession: a cut call', () => {
  it('a normal turn releases with no cut (the 10 s bound)', async () => {
    const ctl = control();
    const s = modelSession(ctl, QWEN);
    await s.use(GEMMA);
    expect(await s.call(GEMMA, async () => 'ok')).toBe('ok');
    await s.releaseAll();
    expect(ctl.release.mock.calls).toEqual([[[QWEN], undefined], [[QWEN, GEMMA], undefined]]);
  });

  it('a timed-out call is rethrown and its model and why reach releaseAll', async () => {
    const ctl = control();
    const s = modelSession(ctl, QWEN);
    await s.use(GEMMA);
    const cut = new CallCut('planner -> no answer within 180s', GEMMA, 'timed out after 180 s');
    await expect(s.call(GEMMA, async () => { throw cut; })).rejects.toBe(cut);
    await s.releaseAll();
    expect(ctl.release.mock.calls.at(-1)).toEqual([[QWEN, GEMMA], { model: GEMMA, why: 'timed out after 180 s' }]);
  });

  it('another error (HTTP 500) is not a cut', async () => {
    const ctl = control();
    const s = modelSession(ctl, QWEN);
    await expect(s.call(QWEN, async () => { throw new Error('planner -> HTTP 500'); })).rejects.toThrow('HTTP 500');
    await s.releaseAll();
    expect(ctl.release.mock.calls.at(-1)).toEqual([[QWEN], undefined]);
  });
});
