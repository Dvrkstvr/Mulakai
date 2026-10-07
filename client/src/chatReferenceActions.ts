/** The chat store's C3 actions (F-061, F-062, D-129), split out of `chatStore.ts` so it keeps room under the cap:
 * SEND's gate and the attachment it carries, READ on an analyze card (the reading job, then the follow-up turn the
 * server queues) and RE-ANALYZE. Card states go only through `chatReading`; the store hands in its getters. */
import { chatApi, type ChatAttach, type ChatThreadView } from './api/chat';
import type { RangeMark } from './api/chatAnalysis';
import { chatReferencesApi } from './api/chatReferences';
import { attachBlocksSend, attachToSend, useChatAttachStore } from './chatAttachStore';
import { readingHoldsSend, type ReadingEvent, type ReadingState } from './chatReading';

export interface ChatReferenceDeps {
  thread: () => ChatThreadView | null;
  readingState: () => ReadingState;
  reading: (e: ReadingEvent) => void;
  refetch: () => Promise<void>;
  followCards: () => void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function chatReferenceActions(d: ChatReferenceDeps) {
  const attachment = () => useChatAttachStore.getState().byThread[d.thread()?.id ?? ''];

  return {
    /** SEND / RETRY are live: no reading or its follow-up running (D-129), no upload in flight. */
    free: () => !readingHoldsSend(d.readingState()) && !attachBlocksSend(attachment()),
    /** What SEND carries: the composer's attached reference, else nothing. */
    attachToSend: () => attachToSend(attachment()),

    /** POST the turn with `attach` (and C1's `mark`) when there is one; the chip clears once the server has the message. */
    startTurn: async (threadId: string, text: string, clientKey: string, attach: ChatAttach | null, mark?: RangeMark | null) => {
      const started = mark
        ? await chatApi.startChatTurn(threadId, text, clientKey, attach, mark)
        : await chatApi.startChatTurn(threadId, text, clientKey, ...(attach ? [attach] : []));
      if (attach) useChatAttachStore.getState().sent(threadId);
      return started;
    },

    /** READ on an analyze card: the reading job, then the follow-up turn (D-129). */
    read: async (proposalId: string): Promise<void> => {
      const thread = d.thread();
      const card = thread?.messages.find((m) => m.kind === 'analyze' && m.proposalId === proposalId);
      if (!thread || !card) return;
      const before = d.readingState();
      d.reading({ type: 'read', messageId: card.id });
      if (d.readingState() === before) return; // not live (superseded, expired, already read)
      const fail = (reason: string) => d.reading({ type: 'refused', messageId: card.id, reason });
      try {
        const started = await chatReferencesApi.readReference(thread.id, proposalId);
        if ('refused' in started) return fail(started.refused);
        await d.refetch(); // the analyze card done, the reading card with its job
        d.followCards();
      } catch (err) {
        fail(message(err));
      }
    },

    /** RE-ANALYZE from the song panel: null when it started, else the server's reason. */
    reanalyze: async (referenceId: string): Promise<string | null> => {
      try {
        const started = await chatReferencesApi.rereadReference(referenceId);
        if ('refused' in started) return started.refused;
        await d.refetch();
        d.followCards();
        return null;
      } catch (err) {
        return message(err);
      }
    },
  };
}
