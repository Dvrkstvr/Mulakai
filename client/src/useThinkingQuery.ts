import { useEffect, useRef, useState } from 'react';
import { api, type RefineResult } from './api';

export type ThinkingPhase = 'idle' | 'thinking' | 'revealing';

/** Drives the Quick Start "AI thinking" reveal (CreateView.tsx): runs sampleFromQuery
 * for a pending library-bar draft and hands the result to `onResult` once the LM
 * responds, so the caller can start the ThinkingWipe + typewriter reveal in sync. */
export function useThinkingQuery(pendingQuery: string | undefined, onResult: (r: RefineResult) => void) {
  const [phase, setPhase] = useState<ThinkingPhase>(pendingQuery ? 'thinking' : 'idle');
  const [error, setError] = useState('');
  const attempt = useRef(0);

  const run = () => {
    if (!pendingQuery) return;
    const id = ++attempt.current;
    setError('');
    setPhase('thinking');
    api.sampleFromQuery(pendingQuery)
      .then((r) => { if (attempt.current === id) { setPhase('revealing'); onResult(r); } })
      .catch((err) => {
        if (attempt.current !== id) return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase('idle');
      });
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, error, retry: run, finish: () => setPhase('idle') };
}
