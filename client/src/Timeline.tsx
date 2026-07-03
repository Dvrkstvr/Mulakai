import { useRef } from 'react';

interface Props {
  duration: number;
  playhead: number;
  onSeek: (seconds: number) => void;
}

/** Standalone scrub strip for placing the playhead — decoupled from the waveform's selection-drag surface. */
export function Timeline({ duration, playhead, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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
  }

  return (
    <div className="timeline">
      <div className="timeline-time">
        <span>{fmt(playhead)}</span>
        <span>{fmt(duration)}</span>
      </div>
      {/* Baseline + ruler ticks only — the moving thumb is drawn once by the shared
          .stack-playhead overlay in LayerStack.tsx so it reads as one continuous line
          through every lane. */}
      <div
        ref={trackRef}
        className="timeline-track"
        onMouseDown={(e) => { dragging.current = true; onSeek(toSeconds(e.clientX)); }}
        onMouseMove={(e) => { if (dragging.current) onSeek(toSeconds(e.clientX)); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
      >
        {ticks.map((t) => (
          <div key={t} className="timeline-tick" style={{ left: `${(t / duration) * 100}%` }}>
            <span>{fmt(t)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
