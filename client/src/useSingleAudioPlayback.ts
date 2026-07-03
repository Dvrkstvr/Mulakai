import { useEffect, useRef, useState } from 'react';
import type { PlaybackApi } from './mix/playerApi';

/**
 * Single-track playback behind the same PlaybackApi shape Player.tsx expects
 * — used by the library footer mini-player, which only ever plays one song
 * at a time and has no layers to mix, so the full Web Audio PlaybackEngine
 * would be overkill.
 */
export function useSingleAudioPlayback(src: string, autoPlay?: boolean): PlaybackApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = new Audio(src);
    audioRef.current = a;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    setCurrentTime(0);
    setDuration(0);
    if (autoPlay) void a.play();
    return () => {
      a.pause();
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return {
    isPlaying,
    currentTime,
    duration,
    play: () => void audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    stop: () => { const a = audioRef.current; if (a) { a.pause(); a.currentTime = 0; } setCurrentTime(0); },
    seek: (s: number) => { const a = audioRef.current; if (a) a.currentTime = s; setCurrentTime(s); },
    setVolume: (v: number) => { if (audioRef.current) audioRef.current.volume = v; },
  };
}
