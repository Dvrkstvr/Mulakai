import { useEffect, useRef, useState } from 'react';
import { loadPeaks } from './waveformPeaks';

interface Props {
  audioUrl: string;
  duration: number;
  playhead: number;
  onSeek: (seconds: number) => void;
  height?: number;
  /** Skip drawing the internal playhead line — used when a caller (e.g. LayerLane's shared overlay) draws its own. */
  showPlayhead?: boolean;
  /** Swap click-to-seek for a different action (e.g. focusing a layer lane instead of seeking). */
  onClickOverride?: () => void;
}

const COLORS = { idle: '#55565F', playhead: '#30BCED' };

/** Compact bar waveform + sky playhead for the library mini-player — click to seek, no region selection. */
export function PlayerWaveform({ audioUrl, duration, playhead, onSeek, height = 28, showPlayhead = true, onClickOverride }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPeaks([]);
    loadPeaks(audioUrl, 140).then((p) => { if (!cancelled) setPeaks(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const w = canvas.clientWidth;
    canvas.width = w * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    const g = canvas.getContext('2d')!;
    g.scale(devicePixelRatio, devicePixelRatio);
    g.clearRect(0, 0, w, height);

    const barW = w / peaks.length;
    peaks.forEach((p, i) => {
      const x = i * barW;
      const h = Math.max(2, p * height * 0.9);
      g.fillStyle = COLORS.idle;
      g.fillRect(x + barW * 0.2, (height - h) / 2, barW * 0.6, h);
    });
    if (showPlayhead && duration > 0) {
      g.fillStyle = COLORS.playhead;
      g.fillRect((playhead / duration) * w, 0, 1.5, height);
    }
  }, [peaks, playhead, duration, height, showPlayhead]);

  const seekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (onClickOverride) { onClickOverride(); return; }
    if (duration <= 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  };

  return (
    <canvas
      ref={canvasRef}
      className="player-waveform"
      style={{ width: '100%', height, cursor: 'pointer', display: 'block' }}
      onClick={seekFromEvent}
    />
  );
}
