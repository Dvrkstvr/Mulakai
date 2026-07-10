import { useEffect, useRef } from 'react';
import { ShaderCanvas } from './ShaderCanvas';

const WAVE_AMPLITUDE = 6;
const WAVE_FUZZ = 7;
const WAVE_SPEED = 1.6;

interface AIGeneratingBackgroundProps {
  /** 0-1 job progress. When set, a carbon-tinted veil covers the region from
   * roughly `progress*100%` to the right edge, over the shader — the unveiled
   * (left) portion reads as "how far along this is". Its edge ripples with a
   * soft-blurred wave rather than a straight cut, so it reads as flowing
   * rather than a hard fill gauge. Omit for the plain full shader. */
  progress?: number;
}

/** Canvas-drawn wavy veil edge. A plain CSS `clip-path` can't be blurred — `filter` is
 * re-clipped after `clip-path` in the CSS rendering order — so the wave and its soft
 * edge are both drawn directly with a canvas 2D `blur()` filter each frame instead. */
function useWaveVeil(progressRef: React.MutableRefObject<number | undefined>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.max(1, Math.round(clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (phase: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      if (progressRef.current === undefined) {
        ctx.restore();
        return;
      }
      const baseX = w * progressRef.current;
      const steps = 20;
      ctx.filter = `blur(${WAVE_FUZZ}px)`;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const y = (h * i) / steps;
        const x = baseX + Math.sin((y / h) * Math.PI * 2.4 + phase) * (reduceMotion ? 0 : WAVE_AMPLITUDE);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(28, 29, 33, 0.82)';
      ctx.fill();
      ctx.restore();
    };

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw(reduceMotion ? 0 : ((now - start) / 1000) * WAVE_SPEED);
      raf = requestAnimationFrame(tick);
    };
    tick(start);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [progressRef]);

  return canvasRef;
}

export function AIGeneratingBackground({ progress }: AIGeneratingBackgroundProps = {}) {
  const clamped = progress === undefined ? undefined : Math.max(0, Math.min(1, progress));
  const progressRef = useRef(clamped);
  progressRef.current = clamped;
  const canvasRef = useWaveVeil(progressRef);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <ShaderCanvas />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}
