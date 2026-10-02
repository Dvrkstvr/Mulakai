import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTrack, type TrackAudio } from './singleTrack';

/** Minimal HTMLAudioElement stand-in — vitest runs in node, no DOM. `play` rejects with `playError` if set. */
class FakeAudio implements TrackAudio {
  volume = 1;
  currentTime = 0;
  duration = 0;
  playCalls = 0;
  playError: Error | null = null;
  handlers = new Map<string, Set<() => void>>();
  src: string;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    this.playCalls++;
    if (this.playError) return Promise.reject(this.playError);
    this.emit('play');
    return Promise.resolve();
  }
  pause() {
    this.emit('pause');
  }
  addEventListener(type: string, cb: () => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.handlers.get(type)?.delete(cb);
  }
  emit(type: string) {
    this.handlers.get(type)?.forEach((cb) => cb());
  }
}

const domError = (name: string) => Object.assign(new Error(name), { name });
const events = () => ({ onPlaying: vi.fn(), onTime: vi.fn(), onDuration: vi.fn() });
// Lets a rejected play() settle — an unhandled one fails the vitest run.
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('openTrack', () => {
  it('opens nothing and never plays for an empty src (the library before a song is picked)', () => {
    const createAudio = vi.fn((src: string) => new FakeAudio(src));
    expect(openTrack('', { autoPlay: true, volume: 1 }, events(), createAudio)).toBeNull();
    expect(createAudio).not.toHaveBeenCalled();
  });

  it('autoplays a real src at the remembered volume', () => {
    const ev = events();
    const track = openTrack('/audio/a.mp3', { autoPlay: true, volume: 0.4 }, ev, (s) => new FakeAudio(s))!;
    expect(track.audio.playCalls).toBe(1);
    expect(track.audio.volume).toBe(0.4);
    expect(ev.onPlaying).toHaveBeenCalledWith(true);
  });

  it('only loads when autoPlay is off', () => {
    const track = openTrack('/audio/a.mp3', { autoPlay: false, volume: 1 }, events(), (s) => new FakeAudio(s))!;
    expect(track.audio.playCalls).toBe(0);
  });

  it('leaves the track paused, without an unhandled rejection, when autoplay is blocked', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ev = events();
    const track = openTrack('/audio/a.mp3', { autoPlay: true, volume: 1 }, ev, (s) => {
      const a = new FakeAudio(s);
      a.playError = domError('NotAllowedError');
      return a;
    })!;
    await settle();
    expect(track.audio.playCalls).toBe(1);
    expect(ev.onPlaying).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('close pauses and unwires the element', () => {
    const ev = events();
    const track = openTrack('/audio/a.mp3', { autoPlay: false, volume: 1 }, ev, (s) => new FakeAudio(s))!;
    track.close();
    expect(ev.onPlaying).toHaveBeenCalledWith(false);
    ev.onPlaying.mockClear();
    track.audio.emit('play');
    track.audio.emit('timeupdate');
    expect(ev.onPlaying).not.toHaveBeenCalled();
    expect(ev.onTime).not.toHaveBeenCalled();
  });
});
