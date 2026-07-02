import { useEffect, useRef, useState } from 'react';

export interface Region {
  start: number; // seconds
  end: number;
}

interface Props {
  audioUrl: string;
  duration: number;
  selection: Region | null;
  onSelect: (region: Region | null) => void;
  playhead?: number;
  height?: number;
}

const COLORS = { idle: '#55565F', sel: '#30BCED', selBg: '#153543', playhead: '#30BCED' };

async function loadPeaks(url: string, buckets: number): Promise<number[]> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const data = buf.getChannelData(0);
    const per = Math.floor(data.length / buckets);
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      for (let j = i * per; j < (i + 1) * per; j += 32) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    return peaks;
  } finally {
    void ctx.close();
  }
}

/** Sharp-bar waveform with drag-to-select region (sky) per DESIGN.md. */
export function Waveform({ audioUrl, duration, selection, onSelect, playhead, height = 96 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPeaks(audioUrl, 400).then((p) => { if (!cancelled) setPeaks(p); }).catch(() => {});
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

    const selX = selection && duration > 0
      ? [(selection.start / duration) * w, (selection.end / duration) * w]
      : null;
    if (selX) {
      g.fillStyle = COLORS.selBg;
      g.fillRect(selX[0], 0, selX[1] - selX[0], height);
    }
    const barW = w / peaks.length;
    peaks.forEach((p, i) => {
      const x = i * barW;
      const h = Math.max(2, p * height * 0.9);
      g.fillStyle = selX && x >= selX[0] && x <= selX[1] ? COLORS.sel : COLORS.idle;
      g.fillRect(x + barW * 0.2, (height - h) / 2, barW * 0.6, h);
    });
    if (selX) {
      g.fillStyle = COLORS.sel;
      g.fillRect(selX[0], 0, 1, height);
      g.fillRect(selX[1], 0, 1, height);
    }
    if (playhead !== undefined && duration > 0) {
      g.fillStyle = COLORS.playhead;
      g.fillRect((playhead / duration) * w, 0, 1.5, height);
    }
  }, [peaks, selection, playhead, duration, height]);

  const toSeconds = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return frac * duration;
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, cursor: 'crosshair', display: 'block' }}
      onMouseDown={(e) => { dragStart.current = toSeconds(e); onSelect(null); }}
      onMouseMove={(e) => {
        if (dragStart.current === null) return;
        const now = toSeconds(e);
        onSelect({ start: Math.min(dragStart.current, now), end: Math.max(dragStart.current, now) });
      }}
      onMouseUp={(e) => {
        if (dragStart.current !== null) {
          const now = toSeconds(e);
          if (Math.abs(now - dragStart.current) < 0.2) onSelect(null); // click = clear
        }
        dragStart.current = null;
      }}
      onMouseLeave={() => { dragStart.current = null; }}
    />
  );
}
