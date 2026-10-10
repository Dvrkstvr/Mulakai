import { useEffect, useRef } from 'react';

/** Escape closes the newest open overlay (a ✦ HELP box, the EXPORT menu, a lane's ⋯ menu) and only that one. Each
 * used to add its own document listener and skip a handled event, so the oldest listener, the one underneath,
 * won: Escape on an EXPORT menu opened over a HELP box closed the HELP box. The Editor's own Escape (close the
 * action, useDockKeys) listens on window, so it still runs only when no overlay is open. */
const layers: { close: () => void }[] = [];

export function handleEscape(e: Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'preventDefault'>) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = layers.at(-1);
  if (!top) return;
  e.preventDefault();
  top.close();
}

/** Open an overlay layer; the returned function removes it. */
export function pushEscape(close: () => void): () => void {
  const layer = { close };
  layers.push(layer);
  if (layers.length === 1 && typeof document !== 'undefined') document.addEventListener('keydown', handleEscape);
  return () => {
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
    if (layers.length === 0 && typeof document !== 'undefined') document.removeEventListener('keydown', handleEscape);
  };
}

/** While `open`, this overlay is a layer: Escape calls `close` when it is the newest. */
export function useEscapeLayer(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => (open ? pushEscape(() => closeRef.current()) : undefined), [open]);
}
