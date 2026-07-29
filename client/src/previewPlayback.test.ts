import { describe, it, expect, vi } from 'vitest';
import { createPreviewPlayback, type PreviewAudioElement } from './previewPlayback';

/** Minimal HTMLAudioElement stand-in — vitest runs in node, no DOM. */
class FakeAudio implements PreviewAudioElement {
  currentTime = 0;
  duration = 0;
  readyState = 0;
  paused = true;
  private srcValue = '';
  private handlers = new Map<string, Set<() => void>>();

  get src() {
    return this.srcValue;
  }
  set src(v: string) {
    // Mirrors the real element: assigning src resets the media state.
    this.srcValue = v;
    this.currentTime = 0;
    this.duration = 0;
    this.readyState = 0;
  }
  addEventListener(type: string, cb: () => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(cb);
  }
  emit(type: string) {
    this.handlers.get(type)?.forEach((cb) => cb());
  }
  play() {
    this.paused = false;
    this.emit('play');
  }
  pause() {
    this.paused = true;
    this.emit('pause');
  }
  loadMetadata(duration: number) {
    this.duration = duration;
    this.readyState = 1;
    this.emit('loadedmetadata');
  }
}

const make = () => {
  const audio = new FakeAudio();
  const engine = createPreviewPlayback(() => audio);
  return { audio, engine };
};

describe('previewPlayback', () => {
  it('toggle starts playback and pauses registered main transports', () => {
    const { audio, engine } = make();
    const pauseMain = vi.fn();
    engine.registerMainTransport(pauseMain);
    engine.toggle('a', 'url-a');
    expect(audio.src).toBe('url-a');
    expect(audio.paused).toBe(false);
    expect(engine.getState()).toMatchObject({ key: 'a', playing: true });
    expect(pauseMain).toHaveBeenCalledTimes(1);
  });

  it('toggle on the current key pauses, then resumes (pausing main again)', () => {
    const { audio, engine } = make();
    const pauseMain = vi.fn();
    engine.registerMainTransport(pauseMain);
    engine.toggle('a', 'url-a');
    engine.toggle('a', 'url-a');
    expect(audio.paused).toBe(true);
    expect(engine.getState()).toMatchObject({ key: 'a', playing: false });
    engine.toggle('a', 'url-a');
    expect(audio.paused).toBe(false);
    expect(pauseMain).toHaveBeenCalledTimes(2);
  });

  it('toggle on a different key replaces the current preview', () => {
    const { audio, engine } = make();
    engine.toggle('a', 'url-a');
    audio.loadMetadata(120);
    engine.toggle('b', 'url-b');
    expect(audio.src).toBe('url-b');
    expect(engine.getState()).toMatchObject({ key: 'b', playing: true, currentTime: 0, duration: 0 });
  });

  it('seekFraction before metadata applies once metadata arrives', () => {
    const { audio, engine } = make();
    engine.seekFraction('a', 'url-a', 0.5);
    expect(audio.paused).toBe(false);
    audio.loadMetadata(200);
    expect(audio.currentTime).toBe(100);
    expect(engine.getState()).toMatchObject({ key: 'a', duration: 200, currentTime: 100 });
  });

  it('seekFraction on the current loaded key seeks in place and resumes if paused', () => {
    const { audio, engine } = make();
    engine.toggle('a', 'url-a');
    audio.loadMetadata(100);
    engine.toggle('a', 'url-a'); // pause
    engine.seekFraction('a', 'url-a', 0.25);
    expect(audio.currentTime).toBe(25);
    expect(audio.paused).toBe(false);
    expect(audio.src).toBe('url-a'); // not reloaded
  });

  it('playFrom before metadata applies the absolute seek once metadata arrives, clamped', () => {
    const { audio, engine } = make();
    engine.playFrom('a', 'url-a', 57);
    expect(audio.paused).toBe(false);
    audio.loadMetadata(200);
    expect(audio.currentTime).toBe(57);
    engine.playFrom('b', 'url-b', 500);
    audio.loadMetadata(100);
    expect(audio.currentTime).toBe(100); // clamped to duration
  });

  it('playFrom on the current loaded key seeks in place and resumes if paused', () => {
    const { audio, engine } = make();
    engine.toggle('a', 'url-a');
    audio.loadMetadata(100);
    engine.toggle('a', 'url-a'); // pause
    engine.playFrom('a', 'url-a', 30);
    expect(audio.currentTime).toBe(30);
    expect(audio.paused).toBe(false);
    expect(audio.src).toBe('url-a'); // not reloaded
  });

  it('mainTransportStarted stops the preview entirely', () => {
    const { audio, engine } = make();
    engine.toggle('a', 'url-a');
    engine.mainTransportStarted();
    expect(audio.paused).toBe(true);
    expect(engine.getState()).toMatchObject({ key: null, playing: false, currentTime: 0 });
  });

  it('unregistered main transports stop receiving pause calls', () => {
    const { engine } = make();
    const pauseMain = vi.fn();
    const unregister = engine.registerMainTransport(pauseMain);
    unregister();
    engine.toggle('a', 'url-a');
    expect(pauseMain).not.toHaveBeenCalled();
  });

  it('ended resets playing and time but keeps the key (replay stays one click)', () => {
    const { audio, engine } = make();
    engine.toggle('a', 'url-a');
    audio.loadMetadata(10);
    audio.paused = true;
    audio.emit('ended');
    expect(engine.getState()).toMatchObject({ key: 'a', playing: false, currentTime: 0 });
  });

  it('getState returns a stable reference between changes (useSyncExternalStore contract)', () => {
    const { engine } = make();
    engine.toggle('a', 'url-a');
    expect(engine.getState()).toBe(engine.getState());
  });

  it('subscribe notifies on changes and unsubscribes cleanly', () => {
    const { engine } = make();
    const cb = vi.fn();
    const unsub = engine.subscribe(cb);
    engine.toggle('a', 'url-a');
    expect(cb).toHaveBeenCalled();
    const calls = cb.mock.calls.length;
    unsub();
    engine.stop();
    expect(cb).toHaveBeenCalledTimes(calls);
  });
});
