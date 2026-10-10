import { useEffect, useRef, useState } from 'react';
import { assistApi, type AssistBody, type Suggestion } from './api/assist';
import type { AssistPhase } from './assistCopy';
import { assistTracker } from './assistTracker';

const POLL_MS = 1000;

// Only a queued job can be cancelled; that's fine.
const cancelJob = (jobId: string) => { void assistApi.cancel(jobId).catch(() => undefined); };

/** One ✦ HELP box's request: ask, poll the queued job, keep the suggestions. Asking again replaces the last request;
 * closing the box (unmount) cancels one still waiting in the queue, or still being posted. */
export function useAssist() {
  const [phase, setPhase] = useState<AssistPhase>({ kind: 'idle' });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tracker] = useState(() => assistTracker(cancelJob));
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(timer.current);
    tracker.dispose();
  }, [tracker]);

  const settle = () => { clearTimeout(timer.current); tracker.settle(); };

  const poll = (jobId: string) => {
    timer.current = setTimeout(async () => {
      if (!tracker.isLive(jobId)) return;
      try {
        const s = await assistApi.status(jobId);
        if (!tracker.isLive(jobId)) return;
        if (s.status === 'done') {
          settle();
          setSuggestions(s.assist?.suggestions ?? []);
          setPhase({ kind: 'done', count: s.assist?.suggestions.length ?? 0 });
          return;
        }
        if (s.status === 'failed') {
          settle();
          setPhase({ kind: 'failed', error: s.cancelled ? 'cancelled' : s.error ?? 'help failed' });
          return;
        }
        setPhase(s.status === 'queued'
          ? { kind: 'waiting', position: s.queuePosition ?? null }
          : { kind: 'thinking', seconds: Math.round((Date.now() - started.current) / 1000) });
      } catch { /* a missed poll: try again */ }
      poll(jobId);
    }, POLL_MS);
  };

  const ask = async (body: AssistBody) => {
    clearTimeout(timer.current);
    setPhase({ kind: 'waiting', position: null });
    try {
      const jobId = await tracker.start(() => assistApi.ask(body));
      if (!jobId) return;
      started.current = Date.now();
      poll(jobId);
    } catch (err) {
      setPhase({ kind: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  };

  return { phase, suggestions, ask };
}
