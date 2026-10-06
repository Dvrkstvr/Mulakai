/** The A/B side the player and the song panel share (F-062): one switch, reset when the player goes. */
import { afterEach, describe, expect, it } from 'vitest';
import { useChatAb } from './useChatPlayback';

afterEach(() => useChatAb.getState().reset());

describe('useChatAb', () => {
  it('starts on the song; the pill and the panel flip the same switch', () => {
    expect(useChatAb.getState().side).toBe('song');
    useChatAb.getState().toggle();
    expect(useChatAb.getState().side).toBe('reference');
    useChatAb.getState().toggle();
    expect(useChatAb.getState().side).toBe('song');
  });
  it('reset goes back to the song (a new take, another thread)', () => {
    useChatAb.getState().toggle();
    useChatAb.getState().reset();
    expect(useChatAb.getState().side).toBe('song');
  });
});
