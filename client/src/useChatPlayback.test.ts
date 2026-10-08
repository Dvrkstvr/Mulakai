/** The A/B side the player and the song panel share (F-062): one switch, reset when the player goes. */
import { afterEach, describe, expect, it } from 'vitest';
import { arrivalPlay, useChatAb } from './useChatPlayback';

afterEach(() => useChatAb.getState().reset());

describe('useChatAb', () => {
  it('starts on the song; the pill and the panel flip the same switch', () => {
    expect(useChatAb.getState().side).toBe('song');
    useChatAb.getState().toggle();
    expect(useChatAb.getState().side).toBe('reference');
    useChatAb.getState().toggle();
    expect(useChatAb.getState().side).toBe('song');
  });
  it('BACK TO v1 flips to the previous version (CB-5); PLAY on a version card goes back to the song and asks to play', () => {
    useChatAb.getState().toggle('previous');
    expect(useChatAb.getState().side).toBe('previous');
    const nonce = useChatAb.getState().playNonce;
    useChatAb.getState().playSong();
    expect(useChatAb.getState()).toMatchObject({ side: 'song', playNonce: nonce + 1 });
  });
  it('a lyrics-panel double-click asks to play the song from its seconds (F-056): back to the song, each ask new', () => {
    useChatAb.getState().toggle('previous');
    useChatAb.getState().setNote('NOW PLAYING THE NEW VERSION');
    useChatAb.getState().playAt(12.5);
    const first = useChatAb.getState().playAtAsk;
    expect(useChatAb.getState()).toMatchObject({ side: 'song', note: null, playAtAsk: { at: 12.5 } });
    useChatAb.getState().playAt(12.5);
    expect(useChatAb.getState().playAtAsk).not.toBe(first);
    expect(useChatAb.getState().playAtAsk!.n).toBe(first!.n + 1);
  });
  it('the lilac note (NOW PLAYING THE NEW VERSION) lasts until cleared; reset clears it', () => {
    useChatAb.getState().setNote('NOW PLAYING THE NEW VERSION');
    expect(useChatAb.getState().note).toBe('NOW PLAYING THE NEW VERSION');
    useChatAb.getState().reset();
    expect(useChatAb.getState().note).toBeNull();
  });
  it('reset goes back to the song (a new take, another thread)', () => {
    useChatAb.getState().toggle();
    useChatAb.getState().reset();
    expect(useChatAb.getState().side).toBe('song');
  });
  it('a take landing in the chat (v1 or an APPLY) asks the chat player to play it; reset drops the ask', () => {
    useChatAb.getState().toggle('previous');
    useChatAb.getState().arrive();
    const first = useChatAb.getState().arrived;
    expect(first).not.toBeNull();
    expect(useChatAb.getState().side).toBe('song');
    useChatAb.getState().arrive();
    expect(useChatAb.getState().arrived).not.toBe(first);
    useChatAb.getState().reset();
    expect(useChatAb.getState().arrived).toBeNull();
  });
});

describe('arrivalPlay: when the chat player starts a take that just landed', () => {
  it('v1: the player mounts on the new take (no old file to wait out) and plays once it knows its length', () => {
    expect(arrivalPlay(null, '/audio/v1.mp3', 0, false)).toBe('wait');
    expect(arrivalPlay(null, '/audio/v1.mp3', 92, false)).toBe('play');
  });
  it('an APPLY: waits while the old version is still loaded, then plays the new one (via the swap when it carries)', () => {
    expect(arrivalPlay('/audio/v1.mp3', '/audio/v1.mp3', 92, false)).toBe('wait');
    expect(arrivalPlay('/audio/v1.mp3', '/audio/v2.mp3', 92, true)).toBe('carry');
    expect(arrivalPlay('/audio/v1.mp3', '/audio/v2.mp3', 0, false)).toBe('wait');
    expect(arrivalPlay('/audio/v1.mp3', '/audio/v2.mp3', 95, false)).toBe('play');
  });
});
