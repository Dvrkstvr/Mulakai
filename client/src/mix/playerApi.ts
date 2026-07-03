/** Shared transport interface Player.tsx drives — implemented by both the multi-layer PlaybackEngine (editor) and a single-track native-audio adapter (library footer). */
export interface PlaybackApi {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
}
