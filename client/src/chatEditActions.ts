/** APPLY and its CANCEL on an edit card (C0b, CB-5; F-047, F-049 #1 and edge), kept out of `chatStore.ts` (the cap) as
 * C3's `chatReferenceActions`. Every state change goes through `chatCommit` (`apply: true`); the job is followed by
 * `chatPoll.followCommit`; a stale refusal refetches so the card reads STALE from the server. */
import { chatApi, type ChatThreadView } from './api/chat';
import { chatEditApi } from './api/chatEdit';
import type { CommitEvent, CommitState } from './chatTurn';

export interface ChatEditDeps {
  thread: () => ChatThreadView | null;
  commitState: () => CommitState | null;
  commit: (e: CommitEvent) => void;
  refetch: () => Promise<void>;
  followCommit: (jobId: string) => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const open = (c: CommitState | null) => !c || c.phase.kind === 'failed' || c.phase.kind === 'cancelled';

export function chatEditActions(d: ChatEditDeps) {
  async function apply(proposalId: string): Promise<void> {
    const thread = d.thread();
    if (!thread || !open(d.commitState())) return;
    d.commit({ type: 'start', proposalId, apply: true });
    try {
      const started = await chatEditApi.applyChatEdit(thread.id, proposalId);
      if ('refused' in started) {
        d.commit({ type: 'refused', error: started.refused, stale: started.stale });
        if (started.stale) await d.refetch();
        return;
      }
      d.commit({ type: 'started', jobId: started.jobId });
      await d.refetch();
      void d.followCommit(started.jobId);
    } catch (err) {
      d.commit({ type: 'refused', error: message(err) });
    }
  }

  /** CANCEL while queued, rendering or splicing (the server deletes the temp render); SAVING has no CANCEL. */
  async function cancelApply(): Promise<void> {
    const c = d.commitState();
    if (c?.apply && c.jobId) await chatApi.cancelChatJob(c.jobId).catch(() => undefined); // the poll says how it ended
  }

  return { apply, cancelApply };
}
