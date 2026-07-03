import { useEffect, useRef, useState } from 'react';
import { hitTestRegion, applyDrag, type DragMode } from './regionDrag';
import { REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS } from './repaintLimits';
import { loadPeaks } from './waveformPeaks';

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
  isFadingOut?: boolean;
  onSeek?: (seconds: number) => void;
  /** When false: no drag-to-select, no double-click-seek — double-click instead calls onFocus (non-focused lane). Defaults true. */
  interactive?: boolean;
  /** Click/double-click target used in place of seeking when `interactive` is false. */
  onFocus?: () => void;
}

const COLORS = { idle: '#55565F', sel: '#30BCED', selBg: '#153543', playhead: '#30BCED' };
const EDGE_TOLERANCE_PX = 8;
const CURSOR: Record<DragMode, string> = { create: 'crosshair', move: 'move', 'resize-start': 'ew-resize', 'resize-end': 'ew-resize' };

/** Sharp-bar waveform with drag-to-select region (sky) per DESIGN.md. */
export function Waveform({ audioUrl, duration, selection, onSelect, playhead, height = 96, isFadingOut, onSeek, interactive = true, onFocus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [animProgress, setAnimProgress] = useState(1);
  const [selRevealProgress, setSelRevealProgress] = useState(1);
  const [hoverMode, setHoverMode] = useState<DragMode>('create');
  const dragMode = useRef<DragMode | null>(null);
  const dragStartSeconds = useRef(0);
  const dragOrigin = useRef<Region | null>(null);
  const prevSelection = useRef<Region | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPeaks([]);
    setAnimProgress(0);
    loadPeaks(audioUrl, 400).then((p) => { if (!cancelled) setPeaks(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [audioUrl]);

  useEffect(() => {
    if (peaks.length === 0) return;
    let frameId: number;
    let start = performance.now();
    const durationMs = 600;
    const tick = (now: number) => {
      if (isFadingOut) {
        const p = Math.max(0, 1 - (now - start) / durationMs);
        setAnimProgress(p);
        if (p > 0) frameId = requestAnimationFrame(tick);
      } else {
        const p = Math.min(1, (now - start) / durationMs);
        setAnimProgress(p);
        if (p < 1) frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [peaks, isFadingOut]);

  // Selection wash "expands from center" when a region is set programmatically (e.g. double-click
  // a version's region in VersionHistory) rather than snapping in — live drag-to-select already
  // grows continuously with the mouse, so it's excluded via dragMode.current.
  useEffect(() => {
    const isNewProgrammaticSelection = selection && selection !== prevSelection.current && dragMode.current === null;
    prevSelection.current = selection;
    if (!isNewProgrammaticSelection) {
      setSelRevealProgress(1);
      return;
    }
    setSelRevealProgress(0);
    let frameId: number;
    const start = performance.now();
    const durationMs = 220;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setSelRevealProgress(p);
      if (p < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [selection]);

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
      const mid = (selX[0] + selX[1]) / 2;
      const halfWidth = ((selX[1] - selX[0]) / 2) * selRevealProgress;
      g.fillStyle = COLORS.selBg;
      g.fillRect(mid - halfWidth, 0, halfWidth * 2, height);
    }
    const barW = w / peaks.length;
    const fadeWidth = 0.2;
    peaks.forEach((p, i) => {
      const barProgress = i / peaks.length;
      let opacity = 1;
      if (animProgress < 1) {
         opacity = Math.max(0, Math.min(1, (animProgress * (1 + fadeWidth) - barProgress) / fadeWidth));
      }
      if (opacity <= 0) return;

      const x = i * barW;
      const h = Math.max(2, p * height * 0.9);
      g.globalAlpha = opacity;
      g.fillStyle = selX && x >= selX[0] && x <= selX[1] ? COLORS.sel : COLORS.idle;
      g.fillRect(x + barW * 0.2, (height - h) / 2, barW * 0.6, h);
    });
    g.globalAlpha = 1.0;
    if (selX) {
      g.fillStyle = COLORS.sel;
      g.fillRect(selX[0], 0, 1, height);
      g.fillRect(selX[1], 0, 1, height);
    }
    if (playhead !== undefined && duration > 0) {
      g.globalAlpha = animProgress;
      g.fillStyle = COLORS.playhead;
      g.fillRect((playhead / duration) * w, 0, 1.5, height);
      g.globalAlpha = 1.0;
    }
  }, [peaks, selection, playhead, duration, height, animProgress, selRevealProgress]);

  const toSeconds = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return frac * duration;
  };

  const edgeToleranceSeconds = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect && duration > 0 ? (EDGE_TOLERANCE_PX / rect.width) * duration : 0;
  };

  if (!interactive) {
    return (
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, cursor: 'pointer', display: 'block' }}
        onClick={onFocus}
        onDoubleClick={onFocus}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, cursor: CURSOR[hoverMode], display: 'block' }}
      onMouseDown={(e) => {
        const secs = toSeconds(e);
        const mode = hitTestRegion(secs, selection, edgeToleranceSeconds());
        dragMode.current = mode;
        dragStartSeconds.current = secs;
        dragOrigin.current = selection;
        if (mode === 'create') onSelect(null);
      }}
      onMouseMove={(e) => {
        const secs = toSeconds(e);
        if (dragMode.current === null) {
          setHoverMode(hitTestRegion(secs, selection, edgeToleranceSeconds()));
          return;
        }
        onSelect(applyDrag(dragMode.current, dragOrigin.current, dragStartSeconds.current, secs, duration, REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS));
      }}
      onMouseUp={(e) => {
        if (dragMode.current === 'create') {
          const secs = toSeconds(e);
          if (Math.abs(secs - dragStartSeconds.current) < 0.2) onSelect(null); // click = clear
        }
        dragMode.current = null;
      }}
      onMouseLeave={() => { dragMode.current = null; }}
      onDoubleClick={(e) => onSeek?.(toSeconds(e))}
    />
  );
}
