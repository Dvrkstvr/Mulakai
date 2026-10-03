/** ANALYZE AUDIO as a polled job (PLAN.md "UI Redesign", S4 decision 2): submit the source,
 * then follow the job through the server's queue until its `analysis` arrives. */
import { api, ApiError, type RefineResult, type StemKind } from './api';
import { JOB_GONE } from './jobGone';

export const ANALYZE_POLL_MS = 1500;

/** Thrown when the analysis left the queue without running (CANCEL on its UP NEXT row). */
export class AnalyzeCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/** Resolves with ACE-Step's description of the source. `stillWanted` is asked before each poll:
 * once it says no (a newer ANALYZE replaced it), polling stops, a still-queued job is cancelled
 * on the server so it never takes the GPU, and this resolves null. */
export async function analyzeAndWait(
  input: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
  model: string,
  stillWanted: () => boolean = () => true,
): Promise<RefineResult | null> {
  const { jobId } = await api.analyzeSourceAudio(input, model);
  for (;;) {
    await new Promise((r) => setTimeout(r, ANALYZE_POLL_MS));
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
    if (s.status === 'done' && s.analysis) return s.analysis;
    if (s.status === 'failed' || s.status === 'done') {
      if (s.cancelled) throw new AnalyzeCancelled();
      throw new Error(s.error ?? 'analysis failed');
    }
  }
}
