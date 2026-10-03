import { useEffect, useRef, useState } from 'react';
import { api, type RefineResult } from './api';
import { followLmJob, lmWaitNote } from './lmJob';

export type ThinkingPhase = 'idle' | 'thinking' | 'revealing';

/** Drives the Quick Start "AI thinking" reveal (CreateView.tsx): queues sampleFromQuery for a
 * pending library-bar draft (it waits its turn behind any running job, saying so in
 * `waitNote`) and hands the result to `onResult` once the LM responds, so the caller can start
 * the ThinkingWipe + typewriter reveal in sync. Leaving Create stops following it. */
export function useThinkingQuery(pendingQuery: string | undefined, onResult: (r: RefineResult) => void) {
  const [phase, setPhase] = useState<ThinkingPhase>(pendingQuery ? 'thinking' : 'idle');
  const [error, setError] = useState('');
  const [position, setPosition] = useState<number | null>(null);
  const attempt = useRef(0);
  const mounted = useRef(true);

  const run = () => {
    if (!pendingQuery) return;
    const id = ++attempt.current;
    const current = () => mounted.current && attempt.current === id;
    setError('');
    setPhase('thinking');
    followLmJob(() => api.sampleFromQuery(pendingQuery), (p) => current() && setPosition(p), current)
      .then((r) => {
        if (!current()) return;
        setPosition(null);
        if (r) { setPhase('revealing'); onResult(r); } else setPhase('idle'); // cancelled from UP NEXT
      })
      .catch((err) => {
        if (!current()) return;
        setPosition(null);
        setError(err instanceof Error ? err.message : String(err));
        setPhase('idle');
      });
  };

  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waitNote = phase === 'thinking' ? lmWaitNote('QUICK START', position) : null;
  return { phase, error, waitNote, retry: run, finish: () => setPhase('idle') };
}
