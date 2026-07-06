import { useMemo, useRef } from 'react';
import { useHeaderSlot } from './HeaderSlot';

interface Props {
  onBack: () => void;
}

/** Placeholder for the FORGE view (LoRA/dataset training studio — see FORGE_PLAN.md).
 * Deliberately non-functional: the real dataset/training/adapter UI is deferred until
 * Mulakai reaches release 1.0. Only reachable when Settings > Forge is switched on. */
export function ForgeStub({ onBack }: Props) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  return (
    <div className="view-fill" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
      <div className="settings-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <span className="section-label" style={{ color: 'var(--lilac-text)' }}>FORGE</span>
        <div className="hint">
          LoRA/LoKr dataset and training studio — deferred until Mulakai reaches release 1.0.
          See FORGE_PLAN.md for the planned dataset browser, training launcher, and adapter
          management this will eventually hold.
        </div>
      </div>
    </div>
  );
}
