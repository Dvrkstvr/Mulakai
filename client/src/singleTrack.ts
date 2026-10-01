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

// Rejections that just mean "not playing yet": the autoplay policy blocked a play() with no
// user gesture behind it (e.g. a generation finishing after a reload), or a pause()/new src
// landed before playback began. Either way the track stays loaded and paused, PLAY ready.
const STAYS_PAUSED = new Set(['NotAllowedError', 'AbortError']);

/** `play()` whose rejection is handled — a bare `void a.play()` surfaces it as an unhandled rejection. */
export function playOrStayPaused(a: Pick<TrackAudio, 'play'>): void {
  a.play().catch((err: unknown) => {
    const name = (err as { name?: unknown } | null)?.name;
    if (typeof name !== 'string' || !STAYS_PAUSED.has(name)) console.error('Footer player: play() failed', err);
  });
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
  if (opts.autoPlay) playOrStayPaused(a);
  return {
    audio: a,
    close: () => {
      a.pause();
      for (const [type, cb] of Object.entries(handlers)) a.removeEventListener(type, cb);
    },
  };
}
