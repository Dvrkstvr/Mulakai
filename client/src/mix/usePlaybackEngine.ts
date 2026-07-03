import { useEffect, useMemo, useRef, useState } from 'react';
import type { Layer } from '../api';
import { activeLayers } from './activeLayers';
import { PlaybackEngine } from './playbackEngine';
import type { LayerAudioInput } from './decodeLayers';
import type { PlaybackApi } from './playerApi';

export type { PlaybackApi };

/**
 * Stable key for the audible layer *set* — deliberately excludes volume.
 * Volume changes are pushed live via `setLayerVolume` (see the effect
 * below); only mute/solo/active-version changes (which add/remove sources,
 * not just adjust gain) should trigger a full reload+restart.
 */
function audibleStructureKey(layers: Layer[]): string {
  return activeLayers(layers)
    .map((l) => {
      const v = l.versions.find((ver) => ver.active);
      return `${l.id}:${v?.audio_file ?? ''}`;
    })
    .join('|');
}

/**
 * React glue around PlaybackEngine: (re)loads the audible layer set whenever
 * mute/solo/volume/active-version state changes (not on plain focus swap),
 * and runs a rAF loop to surface a `currentTime` for the UI since
 * AudioBufferSourceNode has no native timeupdate event.
 */
export function usePlaybackEngine(layers: Layer[]): PlaybackApi {
  const engineRef = useRef<PlaybackEngine | null>(null);
  // StrictMode double-invokes effects in dev (mount -> cleanup -> mount again);
  // the cleanup below disposes (closes) the engine's AudioContext on that first
  // synthetic pass, but the ref itself survives it — so `!engineRef.current`
  // alone would never be true again, leaving every future render driving a
  // permanently-closed context (no sound, playhead frozen). Recreate whenever
  // the cached engine is missing OR already disposed.
  if (!engineRef.current || engineRef.current.isDisposed) engineRef.current = new PlaybackEngine();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const key = useMemo(() => audibleStructureKey(layers), [layers]);

  useEffect(() => {
    const engine = engineRef.current!;
    const inputs: LayerAudioInput[] = activeLayers(layers)
      .map((l) => {
        const v = l.versions.find((ver) => ver.active);
        return v ? { id: l.id, audioUrl: `/audio/${v.audio_file}`, volume: l.volume } : null;
      })
      .filter((x): x is LayerAudioInput => x !== null);
    engine.loadLayers(inputs).then(() => setDuration(engine.duration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Volume-only changes update gain live, without redecoding or interrupting playback.
  useEffect(() => {
    const engine = engineRef.current!;
    for (const l of activeLayers(layers)) engine.setLayerVolume(l.id, l.volume);
  }, [layers]);

  useEffect(() => {
    let frame: number;
    // Re-read engineRef.current on every tick rather than capturing it once
    // outside the loop — this effect only runs once ([] deps), but the ref
    // it watches can be swapped later (e.g. StrictMode's disposal-recovery
    // above, on the next real render after its synthetic cleanup pass). A
    // captured-once `engine` would silently keep polling an abandoned
    // instance forever: play()/pause() elsewhere always read the ref fresh
    // and correctly drive the live engine, so audio plays fine, but this
    // loop's isPlaying/currentTime output would never reflect it.
    const tick = () => {
      const engine = engineRef.current;
      if (engine) {
        setCurrentTime(engine.currentTime());
        setIsPlaying(engine.isPlaying);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => engineRef.current?.dispose(), []);

  return {
    isPlaying,
    currentTime,
    duration,
    play: () => { void engineRef.current!.play(); setIsPlaying(true); },
    pause: () => { engineRef.current!.pause(); setIsPlaying(false); },
    stop: () => { engineRef.current!.pause(); engineRef.current!.seek(0); setCurrentTime(0); setIsPlaying(false); },
    seek: (s: number) => { engineRef.current!.seek(s); setCurrentTime(s); },
    setVolume: (v: number) => engineRef.current!.setMasterVolume(v),
  };
}
