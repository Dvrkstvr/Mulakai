import { useEffect, useRef, useState } from 'react';
import { assistApi, type AssistBody, type Suggestion } from './api/assist';
import type { AssistPhase } from './assistCopy';

const POLL_MS = 1000;

/** One ✦ HELP box's request: ask, poll the queued job, keep the suggestions. Asking again replaces the last request;
 * closing the box (unmount) cancels one still waiting in the queue. */
export function useAssist() {
  const [phase, setPhase] = useState<AssistPhase>({ kind: 'idle' });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const live = useRef<{ jobId: string; started: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = () => { clearTimeout(timer.current); live.current = null; };
  useEffect(() => () => {
    const job = live.current;
    stop();
    if (job) void assistApi.cancel(job.jobId).catch(() => undefined); // only a queued job can be cancelled; that's fine
  }, []);

  const poll = (jobId: string) => {
    timer.current = setTimeout(async () => {
      if (live.current?.jobId !== jobId) return;
      try {
        const s = await assistApi.status(jobId);
        if (live.current?.jobId !== jobId) return;
        if (s.status === 'done') {
          stop();
          setSuggestions(s.assist?.suggestions ?? []);
          setPhase({ kind: 'done', count: s.assist?.suggestions.length ?? 0 });
          return;
        }
        if (s.status === 'failed') {
          stop();
          setPhase({ kind: 'failed', error: s.cancelled ? 'cancelled' : s.error ?? 'help failed' });
          return;
        }
        setPhase(s.status === 'queued'
          ? { kind: 'waiting', position: s.queuePosition ?? null }
          : { kind: 'thinking', seconds: Math.round((Date.now() - live.current.started) / 1000) });
      } catch { /* a missed poll: try again */ }
      poll(jobId);
    }, POLL_MS);
  };

  const ask = async (body: AssistBody) => {
    const previous = live.current;
    stop();
    if (previous) void assistApi.cancel(previous.jobId).catch(() => undefined);
    setPhase({ kind: 'waiting', position: null });
    try {
      const { jobId } = await assistApi.ask(body);
      live.current = { jobId, started: Date.now() };
      poll(jobId);
    } catch (err) {
      setPhase({ kind: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  };

  return { phase, suggestions, ask };
}
