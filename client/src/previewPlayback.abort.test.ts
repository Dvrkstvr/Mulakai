import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewPlayback, type PreviewAudioElement } from './previewPlayback';

/**
 * Stand-in that keeps play() pending until `begin()`, like a real element still fetching
 * audio. As in Chromium, a pause() or a new src before then rejects it with AbortError.
 */
class PendingAudio implements PreviewAudioElement {
  currentTime = 0;
  duration = 0;
  readyState = 0;
  private srcValue = '';
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private handlers = new Map<string, Set<() => void>>();

  get src() {
    return this.srcValue;
  }
  set src(v: string) {
    this.abort('The play() request was interrupted by a new load request.');
    this.srcValue = v;
  }
  addEventListener(type: string, cb: () => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(cb);
  }
  play() {
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }
  pause() {
    this.abort('The play() request was interrupted by a call to pause().');
    this.handlers.get('pause')?.forEach((cb) => cb());
  }
  begin() {
    this.pending?.resolve();
    this.pending = null;
    this.handlers.get('play')?.forEach((cb) => cb());
  }
  private abort(message: string) {
    this.pending?.reject(Object.assign(new Error(message), { name: 'AbortError' }));
    this.pending = null;
  }
}

// Lets a rejected play() settle — an unhandled one fails the vitest run.
const settle = () => new Promise((r) => setTimeout(r, 0));

const make = () => {
  const audio = new PendingAudio();
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  return { audio, error, engine: createPreviewPlayback(() => audio) };
};

afterEach(() => vi.restoreAllMocks());

describe('previewPlayback interrupted before playback begins', () => {
  it('a toggle off (or a closed popover) leaves it paused, with no unhandled rejection', async () => {
    const { audio, error, engine } = make();
    engine.toggle('a', 'url-a');
    engine.toggle('a', 'url-a');
    await settle();
    expect(engine.getState()).toMatchObject({ key: 'a', playing: false });
    expect(error).not.toHaveBeenCalled();
    engine.toggle('a', 'url-a');
    audio.begin();
    expect(engine.getState()).toMatchObject({ key: 'a', playing: true });
  });

  it('another preview taking the slot leaves the new one playing', async () => {
    const { audio, error, engine } = make();
    engine.toggle('a', 'url-a');
    engine.playFrom('b', 'url-b', 4);
    await settle();
    audio.begin();
    expect(engine.getState()).toMatchObject({ key: 'b', playing: true });
    expect(error).not.toHaveBeenCalled();
  });

  it('stop() before playback begins is quiet too', async () => {
    const { error, engine } = make();
    engine.seekFraction('a', 'url-a', 0.5);
    engine.stopIfCurrent('a');
    await settle();
    expect(engine.getState()).toMatchObject({ key: null, playing: false });
    expect(error).not.toHaveBeenCalled();
  });
});
