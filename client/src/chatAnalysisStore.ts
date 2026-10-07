/** The player's analysis (F-052, F-053): the open song's `AnalysisView`, its job followed through `jobStatus` (the
 * reading line's states), the view read again when the job ends or the playing version changes, RETRY. Every state
 * change goes through `chatAnalysis`; CL-8b's mark layer, chip and composer read the same state from here. */
import { create } from 'zustand';
import { chatAnalysisApi } from './api/chatAnalysis';
import { INITIAL_ANALYSIS, analysisJob, analysisSettled, chatAnalysis, type AnalysisEvent, type AnalysisState } from './chatAnalysis';
import { follow } from './chatPoll';

/** A view with nothing queued for a version that is not read yet is read again this often, this many times: the save
 * that made the version queues its analysis as it settles, which can land just after the client's first read. */
export const UNREAD_RETRY_MS = 2000;
export const UNREAD_RETRIES = 3;

interface ChatAnalysisStore {
  songId: string | null;
  analysis: AnalysisState;
  /** Show this song's analysis (null: none); the same song reads its view again (a version swapped in). */
  open: (songId: string | null) => Promise<void>;
  event: (e: AnalysisEvent) => void;
  /** RETRY on a failed reading. */
  retry: () => Promise<void>;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useChatAnalysisStore = create<ChatAnalysisStore>((set, get) => {
  const event = (e: AnalysisEvent) => set({ analysis: chatAnalysis(get().analysis, e) });
  let unreadTimer: ReturnType<typeof setTimeout> | null = null;

  /** Follow the view's job until it ends, then read the view again. */
  const followJob = (songId: string) => {
    const jobId = analysisJob(get().analysis);
    if (!jobId) return;
    const alive = () => get().songId === songId && analysisJob(get().analysis) === jobId;
    void follow(jobId, alive, async (job) => {
      event({ type: 'poll', jobId, job });
      if (!analysisSettled(get().analysis)) return false;
      await read(songId);
      return true;
    }, () => read(songId));
  };

  async function read(songId: string, retriesLeft = UNREAD_RETRIES): Promise<void> {
    if (unreadTimer) clearTimeout(unreadTimer);
    unreadTimer = null;
    const view = await chatAnalysisApi.analysisView(songId).catch(() => null);
    if (!view || get().songId !== songId) return;
    event({ type: 'view', view });
    if (analysisJob(get().analysis)) return followJob(songId);
    const unread = view.versionId && view.state.kind === 'none' && view.shown?.versionId !== view.versionId;
    if (unread && retriesLeft > 0) unreadTimer = setTimeout(() => void read(songId, retriesLeft - 1), UNREAD_RETRY_MS);
  }

  return {
    songId: null,
    analysis: INITIAL_ANALYSIS,
    open: async (songId) => {
      if (songId !== get().songId) set({ songId, analysis: INITIAL_ANALYSIS });
      if (songId) await read(songId);
      else if (unreadTimer) clearTimeout(unreadTimer);
    },
    event,
    retry: async () => {
      const songId = get().songId;
      const before = get().analysis;
      event({ type: 'retry' });
      if (!songId || get().analysis === before) return; // not failed, or its POST is already in flight
      try {
        const out = await chatAnalysisApi.retryAnalysis(songId);
        if (get().songId !== songId) return;
        if ('refused' in out) return event({ type: 'retryRefused', reason: out.refused });
        event({ type: 'retryStarted', jobId: out.jobId });
        followJob(songId);
      } catch (err) {
        if (get().songId === songId) event({ type: 'retryRefused', reason: why(err) });
      }
    },
  };
});
