import { useRef, useState } from 'react';

interface Options {
  /** localStorage key the chosen width is persisted under. */
  storageKey: string;
  default: number;
  min: number;
  max: number;
  /** Which way growing the panel moves the handle — 'right' for a left-hand column
   * (handle sits on its right edge, dragging right grows it), 'left' for a right-hand
   * column (handle on its left edge, dragging left grows it). */
  growsToward: 'left' | 'right';
}

/** Drag-to-resize for a fixed-width column, persisted across sessions — used for
 * CreateView's SettingsPanel/RefineRail side columns (docs/design/DESIGN.md's
 * three-screen app model doesn't fix their width, just their role). */
export function useResizableWidth(opts: Options) {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(opts.storageKey));
    return saved >= opts.min && saved <= opts.max ? saved : opts.default;
  });
  const drag = useRef({ x: 0, width });

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = { x: e.clientX, width };
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - drag.current.x;
      const signed = opts.growsToward === 'left' ? -delta : delta;
      setWidth(Math.min(opts.max, Math.max(opts.min, drag.current.width + signed)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setWidth((w) => { localStorage.setItem(opts.storageKey, String(w)); return w; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { width, onPointerDown };
}
