/** The sky mark over the strip's ruler and waveform (F-054; chat-mark.html MK-4, MK-5, MK-8, MK-10): drag on empty
 * waveform to mark, drag an edge's 7 px grip to move it, drag the body to slide it; edges snap to bar lines (Alt frees
 * them) with a dashed pointer and a tag; a click under 0.2 s on empty waveform seeks and clears (Q-116); Esc clears.
 * A seconds-only mark (hatched strip) has dashed edges; a stale one is drawn as a dashed rust outline of its old place
 * and holds new marks until USE BARS or CLEAR MARK. Geometry is `chatMark`'s, the tag's copy `chatMarkLabel`'s. */
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { AnalysisView, RangeMark } from './api/chatAnalysis';
import { dragEdge, markSeconds, moveBody } from './chatMark';
import { snapTag } from './chatMarkLabel';
import { useChatMarkStore } from './chatMarkStore';
import './chatMark.css';

interface Props {
  threadId: string;
  view: AnalysisView;
  /** The playing audio's length (> 0): the layer's x axis. */
  duration: number;
  onSeek: (seconds: number) => void;
}

/** A press shorter than this, without moving, is a click (Q-116). */
const CLICK_MS = 200;
const MOVE_PX = 3;

type Part = 'new' | 'start' | 'end' | 'body';
interface Drag { part: Part; x0: number; t0: number; at: number; from: RangeMark | null; moved: boolean }
const pct = (t: number, d: number) => `${Math.min(100, Math.max(0, (t / d) * 100))}%`;

export function ChatMarkLayer({ threadId, view, duration, onSeek }: Props) {
  const entry = useChatMarkStore((s) => s.byThread[threadId]);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [tag, setTag] = useState<{ edge: 'start' | 'end'; free: boolean } | null>(null);
  const stale = !!entry?.stale;

  useEffect(() => {
    if (!entry) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') useChatMarkStore.getState().clear(threadId); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [entry, threadId]);

  const timeAt = (clientX: number) => {
    const r = layer.current!.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duration;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const part = ((e.target as HTMLElement).dataset.part as Part | undefined) ?? 'new';
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { part: stale ? 'new' : part, x0: e.clientX, t0: timeAt(e.clientX), at: performance.now(), from: entry?.mark ?? null, moved: false };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || (!d.moved && Math.abs(e.clientX - d.x0) < MOVE_PX)) return;
    d.moved = true;
    if (stale) return; // a stale mark holds new marks until USE BARS or CLEAR MARK (CS-11)
    const t = timeAt(e.clientX);
    const free = e.altKey;
    const next = d.part === 'new' ? markSeconds(view, d.t0, t, free, duration)
      : d.part === 'body' ? moveBody(view, d.from!, t - d.t0, free, duration)
        : dragEdge(view, d.from!, d.part, t, free, duration);
    if (next) useChatMarkStore.getState().set(threadId, next);
    const edge = d.part === 'start' || (d.part === 'new' && t < d.t0) ? 'start' : 'end';
    setTag(d.part === 'body' ? null : { edge, free });
  };

  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setTag(null);
    if (!d || d.moved || performance.now() - d.at >= CLICK_MS) return;
    onSeek(timeAt(e.clientX));
    if (d.part === 'new' && !stale) useChatMarkStore.getState().clear(threadId);
  };

  const mark = entry?.mark;
  const secondsOnly = mark && !mark.bars;
  return (
    <div ref={layer} className="chat-mk-layer" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setTag(null); }}>
      {mark && (
        <div
          className={`chat-mk${stale ? ' stale' : ''}${secondsOnly ? ' secs' : ''}`} data-part="body" aria-label={stale ? 'Stale mark' : 'Mark'}
          style={{ left: pct(mark.seconds[0], duration), width: `calc(${pct(mark.seconds[1], duration)} - ${pct(mark.seconds[0], duration)})` }}
        >
          {!stale && <><b className="chat-mk-grip start" data-part="start" /><b className="chat-mk-grip end" data-part="end" /></>}
        </div>
      )}
      {mark && tag && !stale && (
        <>
          <div className="chat-mk-snap" style={{ left: pct(mark.seconds[tag.edge === 'start' ? 0 : 1], duration) }} />
          <span className={`chat-mk-tag${mark.seconds[1] / duration > 0.7 ? ' left' : ''}`} style={{ left: pct(mark.seconds[tag.edge === 'start' ? 0 : 1], duration) }}>
            {snapTag(mark, tag.edge, tag.free, duration)}
          </span>
        </>
      )}
    </div>
  );
}
