import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { PlaybackApi } from './mix/playerApi';

export interface PreviewSnapshot {
  /** Identity of the item currently loaded into the preview element (null = idle). */
  key: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
}

/** The slice of HTMLAudioElement the engine needs — injectable so node tests can fake it. */
export interface PreviewAudioElement {
  src: string;
  currentTime: number;
  duration: number;
  readyState: number;
  play(): void | Promise<void>;
  pause(): void;
  addEventListener(type: string, cb: () => void): void;
}

/**
 * App-wide single-slot preview player (docs/design/DESIGN.md "Unified Audio
 * Preview" / PLAN.md 2026-07-29): every AudioPreview instance shares this one
 * element, so starting any preview stops the previous one and pauses the main
 * transport(s). Previews are auditions, not a second mixer.
 */
export function createPreviewPlayback(createAudio: () => PreviewAudioElement) {
  let audio: PreviewAudioElement | null = null;
  let state: PreviewSnapshot = { key: null, playing: false, currentTime: 0, duration: 0 };
  // Seek requested before the element has metadata — applied on loadedmetadata.
  // A waveform click stores a fraction (duration unknown yet); playFrom stores
  // absolute seconds (e.g. a version's region start).
  let pendingFrac: number | null = null;
  let pendingSeconds: number | null = null;
  const listeners = new Set<() => void>();
  const mainTransports = new Set<() => void>();

  const set = (patch: Partial<PreviewSnapshot>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  const ensureAudio = (): PreviewAudioElement => {
    if (audio) return audio;
    const a = createAudio();
    a.addEventListener('play', () => set({ playing: true }));
    a.addEventListener('pause', () => set({ playing: false }));
    a.addEventListener('ended', () => set({ playing: false, currentTime: 0 }));
    a.addEventListener('timeupdate', () => set({ currentTime: a.currentTime }));
    a.addEventListener('loadedmetadata', () => {
      if (pendingFrac != null && a.duration > 0) {
        a.currentTime = pendingFrac * a.duration;
      } else if (pendingSeconds != null && a.duration > 0) {
        a.currentTime = Math.min(pendingSeconds, a.duration);
      }
      pendingFrac = null;
      pendingSeconds = null;
      set({ duration: a.duration, currentTime: a.currentTime });
    });
    audio = a;
    return a;
  };

  const start = (key: string, src: string, seek: { frac?: number; seconds?: number } | null) => {
    const a = ensureAudio();
    mainTransports.forEach((pause) => pause());
    pendingFrac = seek?.frac ?? null;
    pendingSeconds = seek?.seconds ?? null;
    a.src = src;
    set({ key, playing: false, currentTime: 0, duration: 0 });
    void a.play();
  };

  return {
    getState: () => state,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    /** Play/pause the item at `key`; a different key replaces whatever was previewing. */
    toggle(key: string, src: string) {
      const a = ensureAudio();
      if (state.key === key) {
        if (state.playing) a.pause();
        else {
          mainTransports.forEach((pause) => pause());
          void a.play();
        }
        return;
      }
      start(key, src, null);
    },
    /** Seek to a 0–1 fraction; starts playback (from there) if `key` isn't current yet. */
    seekFraction(key: string, src: string, frac: number) {
      const a = ensureAudio();
      if (state.key === key && a.readyState >= 1 && a.duration > 0) {
        a.currentTime = frac * a.duration;
        set({ currentTime: a.currentTime });
        if (!state.playing) {
          mainTransports.forEach((pause) => pause());
          void a.play();
        }
        return;
      }
      start(key, src, { frac });
    },
    /** Start (or seek) playback at an absolute time — e.g. a version's region start. */
    playFrom(key: string, src: string, seconds: number) {
      const a = ensureAudio();
      if (state.key === key && a.readyState >= 1 && a.duration > 0) {
        a.currentTime = Math.min(seconds, a.duration);
        set({ currentTime: a.currentTime });
        if (!state.playing) {
          mainTransports.forEach((pause) => pause());
          void a.play();
        }
        return;
      }
      start(key, src, { seconds });
    },
    stop() {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      pendingFrac = null;
      pendingSeconds = null;
      set({ key: null, playing: false, currentTime: 0, duration: 0 });
    },
    /** A main transport (footer/editor engine) registers its pause; previews call it on start. */
    registerMainTransport(pause: () => void) {
      mainTransports.add(pause);
      return () => {
        mainTransports.delete(pause);
      };
    },
    /** Main transport started playing — the preview yields (stops entirely, popovers close). */
    mainTransportStarted() {
      if (state.key !== null) this.stop();
    },
  };
}

export type PreviewPlayback = ReturnType<typeof createPreviewPlayback>;

export const previewPlayback: PreviewPlayback = createPreviewPlayback(() => new Audio());

export function usePreviewState(): PreviewSnapshot {
  return useSyncExternalStore(previewPlayback.subscribe, previewPlayback.getState);
}

/**
 * Two-way exclusivity between a main transport and the preview slot: previews
 * pause `engine` when they start; `engine` starting stops any preview.
 */
export function useMainTransportGuard(engine: PlaybackApi) {
  const ref = useRef(engine);
  ref.current = engine;
  useEffect(() => previewPlayback.registerMainTransport(() => ref.current.pause()), []);
  useEffect(() => {
    if (engine.isPlaying) previewPlayback.mainTransportStarted();
  }, [engine.isPlaying]);
}
