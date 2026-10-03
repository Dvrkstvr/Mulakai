/** Create's LM helpers as queued jobs (PLAN.md "UI Redesign", S4): FEELING LUCKY, Quick Start
 * and WRITE FOR ME each wait their turn in the server's queue, since ACE-Step's LM shares the
 * GPU with whatever job runs. These submit one and follow it to what the LM wrote. */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type RefineResult } from './api';
import { JOB_GONE } from './jobGone';
import { startsAfter } from './queueCopy';
import { useQueueStore } from './queueStore';

export const LM_POLL_MS = 1000;

/** Resolves with what the LM wrote, or null when the job was cancelled from UP NEXT or is no
 * longer wanted (`stillWanted`, asked before each poll: a still-queued job is then cancelled
 * so it never takes the GPU). `onWait` hears its place in line (1 = next), then null once it runs. */
export async function followLmJob(
  submit: () => Promise<{ jobId: string }>,
  onWait: (position: number | null) => void = () => {},
  stillWanted: () => boolean = () => true,
): Promise<RefineResult | null> {
  const { jobId } = await submit();
  void useQueueStore.getState().poll(); // the next commit's "starts after N jobs" counts it
  for (;;) {
    await new Promise((r) => setTimeout(r, LM_POLL_MS));
    if (!stillWanted()) {
      void api.cancelJob(jobId).catch(() => {}); // 409 once it started: it then runs out unread
      return null;
    }
    let s: Awaited<ReturnType<typeof api.jobStatus>>;
    try {
      s = await api.jobStatus(jobId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) continue; // a network hiccup, not a failure
      throw new Error(JOB_GONE);
    }
    if (s.status === 'queued') { onWait(s.queuePosition ?? 1); continue; }
    if (s.status === 'loading' || s.status === 'running') { onWait(null); continue; }
    if (s.cancelled) return null;
    if (s.status === 'done' && s.sample) return s.sample;
    throw new Error(s.error ?? 'the LM job failed');
  }
}

/** "FEELING LUCKY waits its turn · starts after 2 jobs", while a job waits; else null. */
export function lmWaitNote(label: string, position: number | null): string | null {
  return position ? `${label} waits its turn · ${startsAfter(position)}` : null;
}

/** One LM helper's state: running (submitted, waiting or running), its wait line, a failure's
 * reason. `run` applies the result once it lands; leaving the screen stops following it (and
 * takes a still-waiting job out of the queue), since nothing is left to apply it to. */
export function useLmJob(label: string) {
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (submit: () => Promise<{ jobId: string }>, apply: (result: RefineResult) => void) => {
    setError('');
    setRunning(true);
    try {
      const result = await followLmJob(submit, (p) => mounted.current && setPosition(p), () => mounted.current);
      if (result && mounted.current) apply(result);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) { setRunning(false); setPosition(null); }
    }
  };
  return { running, waitNote: running ? lmWaitNote(label, position) : null, error, run, clearError: () => setError('') };
}

/** FEELING LUCKY's button state: the LM's random sample, queued like any job. */
export function useLuckyRoll() {
  const lm = useLmJob('FEELING LUCKY');
  return {
    rolling: lm.running, waitNote: lm.waitNote, error: lm.error,
    roll: (apply: (sample: RefineResult) => void) => lm.run(() => api.randomSample(), apply),
  };
}
