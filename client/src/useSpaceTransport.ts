import { useEffect, useRef } from 'react';
import type { PlaybackApi } from './mix/usePlaybackEngine';

/** Space-bar transport for the Editor's playback engine. */
export function useSpaceTransport(engine: PlaybackApi) {
  // Space toggles play/pause; a second press within the window stops
  // instead (seeks to 0) — checked via ref so this only subscribes once
  // and isn't torn down/re-added on every playhead-driven re-render.
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const spaceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const DOUBLE_PRESS_MS = 300;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      if (spaceTimerRef.current !== null) {
        window.clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
        engineRef.current.stop();
        return;
      }
      spaceTimerRef.current = window.setTimeout(() => {
        spaceTimerRef.current = null;
        const live = engineRef.current;
        if (live.isPlaying) live.pause(); else void live.play();
      }, DOUBLE_PRESS_MS);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
