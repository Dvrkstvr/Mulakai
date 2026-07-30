import { useEffect } from 'react';
import { useAdapterStore, activeAdapter } from './adapterStore';

/**
 * States which adapter a commit action will run through, wherever a generation is started.
 *
 * ACE-Step holds one adapter globally and it is chosen on a different screen (Settings >
 * Adapters), so without this line the only evidence that everything is being coloured lives
 * somewhere the user isn't looking. Renders nothing when no adapter is active — the common
 * case, and the reason this can sit on every commit surface without adding noise.
 */
export function ActiveAdapterNote() {
  const ensureLoaded = useAdapterStore((s) => s.ensureLoaded);
  const active = useAdapterStore(activeAdapter);

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  if (!active) return null;

  return (
    <div className="hint">
      through ADAPTER {active.name.toUpperCase()} at {Math.round(active.scale * 100)}% — change it in Settings &gt; Adapters
    </div>
  );
}
