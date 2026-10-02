import { afterEach, describe, expect, it, vi } from 'vitest';
import { playOrStayPaused } from './playOrStayPaused';

const rejectingWith = (name: string) => ({ play: () => Promise.reject(Object.assign(new Error(name), { name })) });
// Lets a rejected play() settle — an unhandled one fails the vitest run.
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('playOrStayPaused', () => {
  it.each(['NotAllowedError', 'AbortError'])('treats %s as staying paused, not a failure', async (name) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    playOrStayPaused(rejectingWith(name), 'Test');
    await settle();
    expect(error).not.toHaveBeenCalled();
  });

  it('still reports a real playback failure, naming the player', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    playOrStayPaused(rejectingWith('NotSupportedError'), 'Preview');
    await settle();
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toBe('Preview: play() failed');
  });

  it('accepts a play() that returns nothing', () => {
    const play = vi.fn();
    playOrStayPaused({ play }, 'Test');
    expect(play).toHaveBeenCalledOnce();
  });
});
