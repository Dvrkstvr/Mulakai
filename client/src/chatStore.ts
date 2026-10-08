/**
 * The open chat thread (F-041, F-042, F-044, F-049): its messages, the turn being sent (a `clientKey` per message),
 * CANCEL and CREATE SONG; polling both jobs and a reopen's rehydration live in `chatPoll`. Every turn and take change
 * goes through `chatTurn` / `chatCommit`; the draft is `chatDraftStore`. Jobs outlive the tab: opening a thread rehydrates them.
 */
import { create } from 'zustand';
import {
  chatApi, type ChatAttach, type ChatMessageView, type ChatRecipeBody, type ChatStatus, type ChatThreadView,
} from './api/chat';
import { MarkStaleError, type RangeMark } from './api/chatAnalysis';
import { assistantOffCause } from './chatEntry';
import { markHoldsSend, useChatMarkStore } from './chatMarkStore';
import { useChatDraftStore } from './chatDraftStore';
import { chatPoll } from './chatPoll';
import { useChatAb } from './useChatPlayback';
import { INITIAL_READING, chatReading, replyAfter, type ReadingEvent, type ReadingState } from './chatReading';
import { chatEditActions } from './chatEditActions';
import { chatReferenceActions } from './chatReferenceActions';
import {
  INITIAL_TURN, canRetry, canSend, chatCommit, chatTurn, lastTurn,
  type CommitEvent, type CommitState, type TurnEvent, type TurnState,
} from './chatTurn';

interface ChatStore {
  status: ChatStatus | null;
  thread: ChatThreadView | null;
  turn: TurnState;
  commit: CommitState | null;
  /** Opening a thread failed: what to say over the empty thread. */
  error: string | null;
  /** NEW CHAT refused (409: a turn or take still runs): the server's reason; the thread stays. */
  refusal: string | null;
  /** C3: the analyze and reading cards (`chatReading`); `lastAttach` = what the last SEND carried, for RETRY. */
  reading: ReadingState;
  lastAttach: ChatAttach | null;
  /** C1: the mark the last SEND carried (RETRY resends it; a stale one is refused by the server, never remapped). */
  lastMark: RangeMark | null;
  loadStatus: () => Promise<ChatStatus | null>;
  openDraft: () => Promise<void>;
  openSong: (songId: string) => Promise<void>;
  /** NEW CHAT: drops the draft thread and its messages (the consequence line said so). */
  newChat: () => Promise<void>;
  type: (text: string) => void;
  /** `mark` (C1): the composer's mark, sent with the turn; a stale mark holds SEND (CS-11). */
  send: (mark?: RangeMark | null) => Promise<void>;
  /** RETRY / SEND AGAIN after a failed, offline, cancelled or interrupted turn. */
  retry: () => Promise<void>;
  cancel: () => Promise<void>;
  create: (proposalId: string) => Promise<void>;
  /** READ on an analyze card: the reading job, then the follow-up turn (D-129). */
  read: (proposalId: string) => Promise<void>;
  /** RE-ANALYZE from the song panel: null when it started, else the server's reason. */
  reanalyze: (referenceId: string) => Promise<string | null>;
  /** C0b: APPLY on an edit card and CANCEL of its job (`chatEditActions`). */
  apply: (proposalId: string) => Promise<void>;
  cancelApply: () => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const newClientKey = () => globalThis.crypto?.randomUUID?.() ?? `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const useChatStore = create<ChatStore>((set, get) => {
  const turn = (e: TurnEvent) => set((s) => ({ turn: chatTurn(s.turn, e) }));
  const commit = (e: CommitEvent) => set((s) => ({ commit: chatCommit(s.commit, e) }));
  const reading = (e: ReadingEvent) => set((s) => ({ reading: chatReading(s.reading, e) }));
  const assistantOn = () => assistantOffCause(get().status) === null;
  const changedBy = (m: ChatMessageView | null | undefined) => (m?.kind === 'recipe' ? (m.body as ChatRecipeBody | null)?.changed : undefined);

  /** Show a thread; `changed` = the fields a reply that just landed filled (sky marks, CH-4). */
  function show(thread: ChatThreadView, changed?: ChatRecipeBody['changed']) {
    set({ thread, error: null, refusal: null });
    reading({ type: 'thread', messages: thread.messages });
    useChatDraftStore.getState().hydrate(thread.id, thread, changed);
  }

  /** Read the open thread again; `settling` = the turn ended, `afterCard` = a reading card's job ended: the
   * reply's filled fields get their marks. */
  async function refetch(settling = false, afterCard?: string): Promise<void> {
    const id = get().thread?.id;
    const thread = id ? await chatApi.chatThread(id).catch(() => null) : null;
    if (!thread || get().thread?.id !== id) return;
    const t = settling ? lastTurn(thread.messages, get().turn.messageId) : null;
    show(thread, changedBy(afterCard ? replyAfter(thread.messages, afterCard) : t?.reply));
    if (t) turn({ type: 'settled', ...t });
  }

  const { followTurn, followCommit, followCards, rehydrate } = chatPoll({
    turnState: () => get().turn, commitState: () => get().commit, readingState: () => get().reading, turn, commit, reading, refetch,
    landed: () => useChatAb.getState().arrive(),
  });
  const edits = chatEditActions({ thread: () => get().thread, commitState: () => get().commit, commit, refetch: () => refetch(), followCommit });
  const refs = chatReferenceActions({
    thread: () => get().thread, readingState: () => get().reading, reading, refetch: () => refetch(), followCards,
  });

  /** A thread opened: the turn and the take it left running carry on (a reload mid-turn, F-049). */
  async function open(load: () => Promise<ChatThreadView>): Promise<void> {
    await useChatDraftStore.getState().flush();
    set({ turn: INITIAL_TURN, commit: null, reading: INITIAL_READING, lastAttach: null, lastMark: null });
    useChatAb.setState({ arrived: null }); // a take that landed on the thread left behind does not play on this one
    try {
      const thread = await load();
      show(thread);
      rehydrate(thread);
    } catch (err) {
      set({ thread: null, error: message(err) });
    }
  }

  async function post(): Promise<void> {
    const { thread, turn: t } = get();
    if (!thread || !t.clientKey) return;
    const draft = useChatDraftStore.getState();
    await draft.flush(); // the rev the server notes at SEND covers every hand edit (CH-6)
    draft.clearFilled();
    try {
      const started = await refs.startTurn(thread.id, t.lastText, t.clientKey, get().lastAttach, get().lastMark);
      turn({ type: 'accepted', ...started });
      await refetch();
      void followTurn(started.jobId);
    } catch (err) {
      if (err instanceof MarkStaleError) useChatMarkStore.getState().refused(thread.id, err.shift); // nothing was written
      turn({ type: 'refused', error: message(err) });
    }
  }

  return {
    status: null, thread: null, turn: INITIAL_TURN, commit: null, error: null, refusal: null, reading: INITIAL_READING,
    lastAttach: null, lastMark: null,

    loadStatus: async () => {
      const status = await chatApi.chatStatus().catch(() => null);
      set({ status });
      return status;
    },
    openDraft: () => open(chatApi.chatDraftThread),
    openSong: (songId) => open(() => chatApi.songChatThread(songId)),
    newChat: async () => {
      const fresh = await chatApi.resetChatDraft().catch((err: unknown) => void set({ refusal: message(err) }));
      if (fresh) await open(async () => fresh); // refused: the thread stays as it is, with the reason
    },
    type: (text) => turn({ type: 'type', text }),

    send: async (mark) => {
      if (!canSend(get().turn, assistantOn()) || !refs.free() || markHoldsSend(get().thread?.id)) return;
      set({ lastAttach: refs.attachToSend(), lastMark: mark ?? null });
      turn({ type: 'send', clientKey: newClientKey() });
      await post();
    },
    retry: async () => {
      if (!canRetry(get().turn, assistantOn()) || !refs.free() || markHoldsSend(get().thread?.id)) return;
      turn({ type: 'retry', clientKey: newClientKey() });
      await post();
    },

    cancel: async () => {
      const { turn: t } = get();
      if (!t.jobId || (t.phase.kind !== 'queued' && t.phase.kind !== 'thinking')) return;
      turn({ type: 'cancel' });
      await chatApi.cancelChatJob(t.jobId).catch(() => undefined); // already settled: the poll says how
    },

    create: async (proposalId) => {
      const { thread } = get();
      if (!thread || (get().commit && get().commit!.phase.kind !== 'failed')) return;
      commit({ type: 'start', proposalId });
      await useChatDraftStore.getState().flush(); // CREATE SONG sends the live draft, not the proposal (F-044)
      try {
        const started = await chatApi.createChatSong(thread.id, proposalId);
        if ('refused' in started) return commit({ type: 'refused', error: started.refused });
        commit({ type: 'started', jobId: started.jobId });
        await refetch();
        void followCommit(started.jobId);
      } catch (err) {
        commit({ type: 'refused', error: message(err) });
      }
    },

    read: refs.read,
    reanalyze: refs.reanalyze,
    apply: edits.apply,
    cancelApply: edits.cancelApply,
  };
});
