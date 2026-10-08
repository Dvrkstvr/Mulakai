/** The edit card's bar map, drawn (F-060, D-215; pipeline/design/chat-converge.html 4a-4d, CX-3). The file is not
 * `ChatBarMap.tsx`: on Windows' case-blind file system `./ChatBarMap` resolves to the pure `chatBarMap.ts`. The song's
 * sections as parallelogram bands, the edited bars as sky-tint cells on one track (2 px at least a bar), a whole-song op hatched
 * over the track, a CUT section's band hatched grey, the ruler, and the caption. The hovered or focused change-list
 * row's bars are solid sky (Q-143); the map itself takes no input. One row up to 200 bars (Q-141 A). Geometry is
 * `chatBarMap.barMapLayout` at the measured width. */
import { useLayoutEffect, useRef, useState } from 'react';
import type { BarMap } from './api/chatConverge';
import { barMapLayout } from './chatBarMap';

/** The card column's map width before it is measured (760 px card, 14 px padding each side). */
const MAP_WIDTH = 730;

interface Props {
  map: BarMap;
  /** The change-list row under the pointer or focus, null for none. */
  hover: number | null;
  /** The bars CUT ops remove: their sections' bands are hatched grey. */
  cuts: Array<[number, number]>;
  caption: string;
}

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => { if (el.clientWidth > 0) setWidth(el.clientWidth); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export function ChatBarMap({ map, hover, cuts, caption }: Props) {
  const [ref, width] = useWidth(MAP_WIDTH);
  const l = barMapLayout(map, width, hover);
  const cut = (from: number, to: number) => cuts.some(([a, b]) => from >= a && to <= b);
  return (
    <div className="chat-bm" ref={ref} aria-label="Bar map" data-bars={map.bars}>
      <div className="chat-bm-bands">
        {l.bands.map((b) => (
          <i
            key={`${b.from}-${b.label}`} title={`${b.label.toUpperCase()} · ${b.from}–${b.to}`}
            className={`${cut(b.from, b.to) ? 'cu' : ''}${b.w < 20 ? ' nc' : ''}`.trim() || undefined}
            style={{ left: px(b.x), width: px(Math.max(1, b.w - 2)) }}
          >{b.text}</i>
        ))}
      </div>
      <div className="chat-bm-track">
        {l.whole && <b className={l.litWhole ? 'wh lit' : 'wh'} />}
        {l.cells.map((c) => <b key={`e${c.from}`} className="e" style={{ left: px(c.x), width: px(c.w) }} />)}
        {l.lit.map((c) => <b key={`l${c.from}`} className="e lit" data-bars={`${c.from}-${c.to}`} style={{ left: px(c.x), width: px(c.w) }} />)}
      </div>
      <div className="chat-bm-ruler">
        {l.ticks.map((t) => <em key={t.bar} style={{ left: px(t.x) }}>{t.text}</em>)}
      </div>
      <div className="chat-bm-cap">{caption}</div>
    </div>
  );
}
