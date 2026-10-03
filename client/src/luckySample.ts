/** FEELING LUCKY as a queued job (PLAN.md "UI Redesign", S4): ACE-Step's LM shares the GPU, so a
 * random sample waits its turn in the server's queue like any other job; this submits it and
 * follows it to its `sample`. */
import { useState } from 'react';
import { api, ApiError, type RefineResult } from './api';
import { JOB_GONE } from './jobGone';
import { startsAfter } from './queueCopy';
import { useQueueStore } from './queueStore';

export const SAMPLE_POLL_MS = 1000;

/** Resolves with the LM's sample, or null when it was cancelled from UP NEXT. `onWait` hears the
 * job's place in line while it waits (1 = next), then null once it runs. */
export async function rollSample(
  onWait: (position: number | null) => void = () => {}, sampleType: 'simple_mode' | 'custom_mode' = 'custom_mode',
): Promise<RefineResult | null> {
  const { jobId } = await api.randomSample(sampleType);
  void useQueueStore.getState().poll();
  for (;;) {
    await new Promise((r) => setTimeout(r, SAMPLE_POLL_MS));
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
    throw new Error(s.error ?? 'FEELING LUCKY failed');
  }
}

/** FEELING LUCKY's state for one button: rolling (submitted, waiting or running), the line it
 * shows while it waits its turn, and a failure's reason. `roll` applies a sample once it lands. */
export function useLuckyRoll() {
  const [rolling, setRolling] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState('');
  const roll = async (apply: (sample: RefineResult) => void) => {
    setError('');
    setRolling(true);
    try {
      const sample = await rollSample(setPosition);
      if (sample) apply(sample);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRolling(false);
      setPosition(null);
    }
  };
  const waitNote = rolling && position ? `FEELING LUCKY waits its turn · ${startsAfter(position)}` : null;
  return { rolling, waitNote, error, roll };
}
