import { playOrStayPaused } from './playOrStayPaused';

/** The slice of HTMLAudioElement the footer player needs — injectable so node tests can fake it. */
export interface TrackAudio {
  volume: number;
  currentTime: number;
  duration: number;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

export interface TrackEvents {
  onPlaying(playing: boolean): void;
  onTime(seconds: number): void;
  onDuration(seconds: number): void;
}

/**
 * Loads `src` into a fresh element, wires its events, and starts it if `autoPlay`. An empty
 * `src` means no song is picked yet (the library on first load): no element and no play(),
 * which on an empty source could only reject. `close` pauses and unwires the element.
 */
export function openTrack<A extends TrackAudio>(
  src: string,
  opts: { autoPlay: boolean; volume: number },
  events: TrackEvents,
  createAudio: (src: string) => A,
): { audio: A; close: () => void } | null {
  if (!src) return null;
  const a = createAudio(src);
  a.volume = opts.volume;
  const handlers: Record<string, () => void> = {
    play: () => events.onPlaying(true),
    pause: () => events.onPlaying(false),
    ended: () => events.onPlaying(false),
    timeupdate: () => events.onTime(a.currentTime),
    loadedmetadata: () => events.onDuration(a.duration),
  };
  for (const [type, cb] of Object.entries(handlers)) a.addEventListener(type, cb);
  if (opts.autoPlay) playOrStayPaused(a, 'Footer player');
  return {
    audio: a,
    close: () => {
      a.pause();
      for (const [type, cb] of Object.entries(handlers)) a.removeEventListener(type, cb);
    },
  };
}
