import { ShaderCanvas } from './ShaderCanvas';

interface AIGeneratingBackgroundProps {
  /** 0-1 job progress. When set, a carbon-tinted veil covers the region from
   * `progress*100%` to the right edge, over the shader — the unveiled (left)
   * portion reads as "how far along this is". Omit for the plain full shader. */
  progress?: number;
}

export function AIGeneratingBackground({ progress }: AIGeneratingBackgroundProps = {}) {
  const clamped = progress === undefined ? undefined : Math.max(0, Math.min(1, progress));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <ShaderCanvas />
      {clamped !== undefined && (
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0, left: `${clamped * 100}%`, right: 0,
            background: 'var(--carbon)', opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}
