import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudioPreview } from './AudioPreview';
import { previewPlayback, usePreviewState } from './previewPlayback';

interface Props {
  src: string;
  /** Shown as the popover's title and spoken by the button. */
  label: string;
  /** Known duration in seconds, for the readout before first play. */
  duration?: number;
  /** Exclusivity identity in the shared preview slot — defaults to `src`. */
  previewKey?: string;
  disabled?: boolean;
}

const WIDTH = 240;
const GAP = 6;

/**
 * The micro audio-preview variant (DESIGN.md "Audio preview module"): an 18px
 * play hexagon for rows too narrow for the inline module. Clicking opens a
 * fixed 240px popover holding the full inline module and starts playback
 * immediately; ✕, Escape, outside click, or scrolling closes it and stops.
 * Rendered into a body portal with `position: fixed` so scrolling rails and
 * framer-transformed view containers can't clip or mis-anchor it.
 */
export function AudioPreviewPopover({ src, label, duration, previewKey = src, disabled }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const state = usePreviewState();
  const owned = state.key === previewKey;
  const playing = owned && state.playing;

  const close = () => {
    if (previewPlayback.getState().key === previewKey) previewPlayback.stop();
    setPos(null);
  };

  // Another preview (or the main transport) took the slot — this popover's
  // audio is no longer live, so it closes without stopping the newcomer.
  useEffect(() => {
    if (pos && !owned) setPos(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // Leaving the screen with the popover open must not leave audio running.
  useEffect(() => () => {
    if (previewPlayback.getState().key === previewKey) previewPlayback.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // host rows often select on click — previewing is not selecting
    if (pos) {
      previewPlayback.toggle(previewKey, src);
      return;
    }
    const r = btnRef.current!.getBoundingClientRect();
    setPos({
      left: Math.max(GAP, Math.min(r.left, window.innerWidth - WIDTH - GAP)),
      top: r.bottom + GAP,
    });
    previewPlayback.toggle(previewKey, src);
  };

  return (
    <>
      <button
        ref={btnRef}
        className={`preview-play micro${playing ? ' playing' : ''}`}
        disabled={disabled}
        onClick={onButtonClick}
        aria-label={`${playing ? 'pause' : 'play'} preview — ${label}`}
        aria-expanded={!!pos}
      />
      {pos &&
        createPortal(
          <div ref={popRef} className="preview-popover" style={{ left: pos.left, top: pos.top }}>
            <div className="preview-popover-head">
              <span className="preview-popover-name">{label}</span>
              <button className="preview-popover-close" onClick={close} aria-label="close preview">✕</button>
            </div>
            <AudioPreview src={src} previewKey={previewKey} label={label} duration={duration} height={30} />
          </div>,
          document.body,
        )}
    </>
  );
}
