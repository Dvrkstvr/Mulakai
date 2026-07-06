import { ShaderCanvas } from './ShaderCanvas';

export function AIGeneratingBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <ShaderCanvas />
    </div>
  );
}
