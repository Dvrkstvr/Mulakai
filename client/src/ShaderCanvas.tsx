import { useEffect, useRef } from 'react';
import { startShader } from './shaderRenderer';

const FILL = 'position:absolute;inset:0;width:100%;height:100%;display:block';

/** Fills its parent with the animated shader (see shaderRenderer.ts). Mount/unmount via
 * `active` — call sites already know when the "AI in progress" state starts/ends
 * (GeneratingCard's !shrunk && !failed, or a toggle's checked state). */
export function ShaderCanvas({ active = true }: { active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active) return;
    // A fresh canvas per run: stopping releases the context, and StrictMode's second run
    // would otherwise get that released context back from the same element.
    const canvas = document.createElement('canvas');
    canvas.style.cssText = FILL;
    host.appendChild(canvas);
    const stop = startShader(canvas);
    return () => {
      stop();
      canvas.remove();
    };
  }, [active]);

  if (!active) return null;
  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}
