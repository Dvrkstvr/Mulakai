import { describe, it, expect, vi, beforeEach } from 'vitest';

// Layer id -> buffer duration (seconds) for the next loadLayers().
const durations = new Map<string, number>();
vi.mock('./decodeLayers', () => ({
  decodeLayers: async (inputs: { id: string; volume: number }[]) =>
    inputs.map((i) => ({ id: i.id, volume: i.volume, buffer: { duration: durations.get(i.id) ?? 0 } })),
}));

/** Minimal AudioBufferSourceNode stand-in — vitest runs in node, no Web Audio. */
class FakeSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  stopped = false;
  connect<T>(node: T) { return node; }
  disconnect() {}
  start() {}
  stop() {
    this.stopped = true;
    // Real sources fire `ended` for a manual stop() too, asynchronously.
    pendingEnded.push(this);
  }
}

let pendingEnded: FakeSource[] = [];
const contexts: FakeContext[] = [];
/** The context of the engine under test (each test builds a fresh one). */
const ctxNow = () => contexts.at(-1)!;
const flushEnded = () => { const q = pendingEnded; pendingEnded = []; q.forEach((s) => s.onended?.()); };

class FakeContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sources: FakeSource[] = [];
  constructor() { contexts.push(this); }
  createGain() { return { gain: { value: 1 }, connect: <T>(n: T) => n, disconnect() {} }; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
vi.stubGlobal('AudioContext', FakeContext);

const { PlaybackEngine } = await import('./playbackEngine');

async function loaded(layers: Record<string, number>) {
  durations.clear();
  for (const [id, d] of Object.entries(layers)) durations.set(id, d);
  const engine = new PlaybackEngine();
  await engine.loadLayers(Object.keys(layers).map((id) => ({ id, audioUrl: `/audio/${id}`, volume: 1 })));
  return engine;
}

/** The live source playing the given layer's buffer (the most recently created one). */
const sourceFor = (duration: number) => ctxNow().sources.filter((s) => s.buffer?.duration === duration).at(-1)!;

beforeEach(() => { pendingEnded = []; });

describe('PlaybackEngine end of song', () => {
  it('stops itself when the longest layer ends, clamping time to the duration', async () => {
    const engine = await loaded({ base: 10, vocals: 6 });
    await engine.play();
    ctxNow().currentTime = 10.2; // onended arrives slightly late
    expect(engine.currentTime()).toBe(10);
    sourceFor(10).onended!();
    expect(engine.isPlaying).toBe(false);
    expect(engine.currentTime()).toBe(10);
  });

  it('only the longest layer ending finishes the song', async () => {
    const engine = await loaded({ base: 10, vocals: 6 });
    await engine.play();
    expect(sourceFor(6).onended).toBeNull();
    expect(sourceFor(10).onended).not.toBeNull();
  });

  it('play after the end starts over from 0', async () => {
    const engine = await loaded({ base: 10 });
    await engine.play();
    ctxNow().currentTime = 10;
    sourceFor(10).onended!();
    await engine.play();
    expect(engine.isPlaying).toBe(true);
    expect(engine.currentTime()).toBe(0);
  });

  type Engine = InstanceType<typeof PlaybackEngine>;
  it.each<[string, (e: Engine) => void, boolean, number]>([
    ['pause', (e) => e.pause(), false, 3],
    ['seek', (e) => e.seek(7), true, 7],
    ['restart', (e) => void e.play(2), true, 2],
  ])('a manual %s does not trip the end handler', async (_name, act, playing, time) => {
    const engine = await loaded({ base: 10 });
    await engine.play();
    ctxNow().currentTime = 3;
    act(engine);
    flushEnded(); // the stopped source's own `ended` event
    expect(engine.isPlaying).toBe(playing);
    expect(engine.currentTime()).toBe(time);
  });

  it('a reload while playing does not trip the end handler', async () => {
    const engine = await loaded({ base: 10 });
    await engine.play();
    ctxNow().currentTime = 4;
    await engine.loadLayers([{ id: 'base', audioUrl: '/audio/base', volume: 1 }]);
    flushEnded();
    expect(engine.isPlaying).toBe(true);
    expect(engine.currentTime()).toBe(4);
  });

  it('a source from a superseded play() cannot end the newer one', async () => {
    const engine = await loaded({ base: 10 });
    await engine.play();
    const first = sourceFor(10);
    await engine.play(5);
    first.onended!();
    expect(engine.isPlaying).toBe(true);
    expect(engine.currentTime()).toBe(5);
  });
});
