import { useEffect, useRef, useState } from 'react';
import type { PlaybackApi } from './mix/playerApi';
import { playOrStayPaused } from './playOrStayPaused';
import { openTrack } from './singleTrack';

/**
 * Single-track playback behind the same PlaybackApi shape Player.tsx expects
 * — used by the library footer mini-player, which only ever plays one song
 * at a time and has no layers to mix, so the full Web Audio PlaybackEngine
 * would be overkill.
 */
export function useSingleAudioPlayback(src: string, autoPlay?: boolean): PlaybackApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Survives the `src` effect below re-running (new song selected): each fresh <audio>
  // element otherwise starts at its own 1.0 default, silently overriding whatever the
  // volume slider was last set to.
  const volumeRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    const track = openTrack(
      src,
      { autoPlay: !!autoPlay, volume: volumeRef.current },
      { onPlaying: setIsPlaying, onTime: setCurrentTime, onDuration: setDuration },
      (s) => new Audio(s),
    );
    audioRef.current = track?.audio ?? null;
    return track?.close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return {
    isPlaying,
    currentTime,
    duration,
    play: () => { if (audioRef.current) playOrStayPaused(audioRef.current, 'Footer player'); },
    pause: () => audioRef.current?.pause(),
    stop: () => { const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; } setCurrentTime(0); },
    seek: (s: number) => { const a = audioRef.current; if (a) a.currentTime = s; setCurrentTime(s); },
    setVolume: (v: number) => {
      volumeRef.current = v;
      if (audioRef.current) audioRef.current.volume = v;
    },
  };
}
