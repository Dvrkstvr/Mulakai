import { useRef } from 'react';

interface Props {
  duration: number;
  playhead: number;
  onSeek: (seconds: number) => void;
}

/** Standalone scrub strip for placing the playhead — decoupled from the waveform's selection-drag surface. */
export function Timeline({ duration, playhead, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const toSeconds = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * duration;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // Pick a "nice" ruler interval so roughly 5-10 labeled ticks span the track regardless of song length.
  const NICE_STEPS = [5, 10, 15, 30, 60, 120, 300, 600];
  const interval = NICE_STEPS.find((s) => duration / s <= 10) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const ticks: number[] = [];
  if (duration > 0) {
    for (let t = interval; t < duration - interval * 0.4; t += interval) ticks.push(t);
    ticks.push(duration);
  }

  // Drag listeners live on `window` (not the track element) for the duration of the
  // drag, so a fast flick that carries the cursor off the thin track strip — or even
  // outside the browser viewport — still keeps scrubbing instead of dropping the drag.
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    onSeek(toSeconds(e.clientX));
    const onMove = (ev: MouseEvent) => onSeek(toSeconds(ev.clientX));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const playheadPct = duration > 0 ? Math.min(100, Math.max(0, (playhead / duration) * 100)) : 0;

  return (
    // onMouseDown sits on the whole strip (not just the thin track) so the padding
    // around it is grabbable too — a bigger, more forgiving scrub target.
    <div className="timeline" onMouseDown={startDrag}>
      {/* Baseline + ruler ticks only — the moving thumb is drawn once by the shared
          .stack-playhead overlay in LayerStack.tsx so it reads as one continuous line
          through every lane. */}
      <div ref={trackRef} className="timeline-track">
        {duration > 0 && (
          <div className="timeline-current-time" style={{ left: `${playheadPct}%` }}>{fmt(playhead)}</div>
        )}
        {ticks.map((t) => (
          <div key={t} className="timeline-tick" style={{ left: `${(t / duration) * 100}%` }}>
            <span>{fmt(t)}</span>
          </div>
        ))}
        {/* Diamond thumb lives on the sticky timeline itself (not the cross-lane
            .stack-playhead overlay) so it always renders in front of the timeline's
            own opaque background instead of getting hidden behind it. */}
        {duration > 0 && (
          <div className="timeline-playhead-diamond" style={{ left: `${playheadPct}%` }} />
        )}
      </div>
    </div>
  );
}
