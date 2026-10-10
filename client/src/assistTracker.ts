/** Which ✦ HELP request is current. The job id is known only once the POST answers, so an ask replaced, or a box
 * closed, while its POST is still in flight would leave that job queued on the GPU: its job is cancelled the moment
 * the id arrives. (React's StrictMode mount → unmount → mount in dev hits exactly this.) */
export function assistTracker(cancel: (jobId: string) => void) {
  let seq = 0;
  let live: string | null = null;

  return {
    /** Post a new ask, replacing (and cancelling) the current one. Resolves to the job id, or null when a newer ask or
     * dispose() came first. */
    async start(post: () => Promise<{ jobId: string }>): Promise<string | null> {
      const mine = ++seq;
      if (live) cancel(live);
      live = null;
      let jobId: string;
      try {
        ({ jobId } = await post());
      } catch (err) {
        if (mine !== seq) return null;
        throw err;
      }
      if (mine !== seq) { cancel(jobId); return null; }
      live = jobId;
      return jobId;
    },
    isLive: (jobId: string) => live === jobId,
    /** The job settled (done or failed): nothing left to cancel. */
    settle: () => { live = null; },
    /** The box closed: cancel the live job and any still being posted. */
    dispose: () => {
      seq++;
      if (live) cancel(live);
      live = null;
    },
  };
}
