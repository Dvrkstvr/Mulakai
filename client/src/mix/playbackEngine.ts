import { decodeLayers, type DecodedLayer, type LayerAudioInput } from './decodeLayers';

export interface EngineLayerState {
  id: string;
  volume: number;
}

/**
 * Live multi-layer synchronized playback over Web Audio. One
 * AudioBufferSourceNode + GainNode per audible layer, summed to a shared
 * master gain. AudioBufferSourceNodes can only be `start()`-ed once, so
 * every play/seek-while-playing tears down and recreates fresh source nodes
 * from the already-decoded buffers rather than redecoding audio.
 */
export class PlaybackEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private decoded: DecodedLayer[] = [];
  private sources: { id: string; source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private playing = false;
  private positionSeconds = 0; // remembered position while paused
  private startedAtCtxTime = 0; // ctx.currentTime when the current sources were started
  private startOffsetSeconds = 0; // playhead offset those sources were started from

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  get duration(): number {
    return this.decoded.reduce((max, l) => Math.max(max, l.buffer.duration), 0);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** True once `dispose()` has closed the underlying AudioContext — it can't be resumed after this. */
  get isDisposed(): boolean {
    return this.ctx.state === 'closed';
  }

  setMasterVolume(v: number) {
    this.masterGain.gain.value = v;
  }

  /** Current playhead position in seconds, live-derived from AudioContext time while playing. */
  currentTime(): number {
    if (!this.playing) return this.positionSeconds;
    return this.startOffsetSeconds + (this.ctx.currentTime - this.startedAtCtxTime);
  }

  /**
   * Redecode the given layers. Called when the set of audible layers changes
   * (mute/solo/volume affecting which layers should play) or a layer's
   * active version changes — NOT on a plain focus change, which never
   * touches this. Preserves playback position/state across the swap.
   */
  async loadLayers(inputs: LayerAudioInput[]): Promise<void> {
    const wasPlaying = this.playing;
    const resumeAt = this.currentTime();
    this.stopSources();
    try {
      this.decoded = inputs.length ? await decodeLayers(inputs, this.ctx) : [];
    } catch (err) {
      // Swallowing this previously left `decoded` silently empty forever —
      // no sound, no error, no way to tell playback wasn't actually loaded.
      console.error('PlaybackEngine: failed to decode layer audio', err);
      this.decoded = [];
    }
    this.positionSeconds = resumeAt;
    if (wasPlaying) void this.play(resumeAt);
  }

  /** Update a single layer's gain without redecoding or interrupting playback. */
  setLayerVolume(id: string, volume: number) {
    const entry = this.decoded.find((l) => l.id === id);
    if (entry) entry.volume = volume;
    const active = this.sources.find((s) => s.id === id);
    if (active) active.gain.gain.value = volume;
  }

  /**
   * `resume()` must be awaited before scheduling sources — reading
   * `ctx.currentTime` (for the start-time anchor) right after firing
   * `resume()` without waiting can capture a stale pre-resume value, and a
   * rejected resume (autoplay policy) would previously fail silently,
   * leaving sources scheduled on a context that never actually starts
   * (no sound, and currentTime() — the playhead — never advances either).
   */
  async play(fromSeconds?: number): Promise<void> {
    const offset = Math.max(0, fromSeconds ?? this.positionSeconds);
    this.stopSources();
    if (this.ctx.state !== 'running') {
      await this.ctx.resume().catch((err) => console.error('PlaybackEngine: AudioContext.resume() failed', err));
    }
    const startCtxTime = this.ctx.currentTime;
    this.sources = this.decoded.map((layer) => {
      const source = this.ctx.createBufferSource();
      source.buffer = layer.buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = layer.volume;
      source.connect(gain).connect(this.masterGain);
      const withinBuffer = Math.min(offset, layer.buffer.duration);
      source.start(startCtxTime, withinBuffer);
      return { id: layer.id, source, gain };
    });
    this.startedAtCtxTime = startCtxTime;
    this.startOffsetSeconds = offset;
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this.positionSeconds = this.currentTime();
    this.stopSources();
    this.playing = false;
  }

  seek(seconds: number) {
    const clamped = Math.max(0, seconds);
    if (this.playing) {
      void this.play(clamped);
    } else {
      this.positionSeconds = clamped;
    }
  }

  private stopSources() {
    for (const { source } of this.sources) {
      try { source.stop(); } catch { /* already stopped/ended */ }
      source.disconnect();
    }
    this.sources = [];
  }

  dispose() {
    this.stopSources();
    this.masterGain.disconnect();
    void this.ctx.close();
  }
}
