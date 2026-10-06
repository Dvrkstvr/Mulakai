/** The chat player's source swap (F-062; C0b's CB-5 reuses it for versions): one `useSingleAudioPlayback` whose
 * source flips between the song and its reference, keeping the position (clamped by `chatAb`) and the play state.
 * `useChatAb` is the one switch the player's pill and the song panel's A/B both flip. */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { abResume, abSide, abSource, abToggle, type AbCarry, type AbSide, type AbSources } from './chatAb';
import type { PlaybackApi } from './mix/playerApi';
import { useSingleAudioPlayback } from './useSingleAudioPlayback';

interface ChatAb { side: AbSide; toggle: () => void; reset: () => void }

export const useChatAb = create<ChatAb>((set) => ({
  side: 'song',
  toggle: () => set((s) => ({ side: abToggle(s.side) })),
  reset: () => set({ side: 'song' }),
}));

export interface ChatPlayback { engine: PlaybackApi; side: AbSide; src: string }

export function useChatPlayback(sources: AbSources): ChatPlayback {
  const side = abSide(sources, useChatAb((s) => s.side));
  const src = abSource(sources, side);
  const engine = useSingleAudioPlayback(src);
  const { currentTime, isPlaying, duration } = engine;
  const carry = useRef<AbCarry | null>(null);
  const first = useRef(true);

  // The source flipped: this render still holds the old file's time and play state; carry them over.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    carry.current = { at: currentTime, play: isPlaying };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // The new file knows its length: seek to the same seconds (clamped) and play on if it was playing.
  useEffect(() => {
    const c = carry.current;
    const r = c && abResume(c, duration);
    if (!r) return;
    carry.current = null;
    engine.seek(r.seek);
    if (r.play) engine.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  return { engine, side, src };
}
