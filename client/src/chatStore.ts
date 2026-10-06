/**
 * The open chat thread (F-041, F-042, F-044, F-049): its messages, the turn being sent (a `clientKey` per message),
 * CANCEL and CREATE SONG; polling both jobs and a reopen's rehydration live in `chatPoll`. Every turn and take change
 * goes through `chatTurn` / `chatCommit`; the draft is `chatDraftStore`. Jobs outlive the tab: opening a thread rehydrates them.
 */
import { create } from 'zustand';
import { chatApi, type ChatRecipeBody, type ChatStatus, type ChatThreadView } from './api/chat';
import { assistantOffCause } from './chatEntry';
import { useChatDraftStore } from './chatDraftStore';
import { chatPoll } from './chatPoll';
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
  loadStatus: () => Promise<ChatStatus | null>;
  openDraft: () => Promise<void>;
  openSong: (songId: string) => Promise<void>;
  /** NEW CHAT: drops the draft thread and its messages (the consequence line said so). */
  newChat: () => Promise<void>;
  type: (text: string) => void;
  send: () => Promise<void>;
  /** RETRY / SEND AGAIN after a failed, offline, cancelled or interrupted turn. */
  retry: () => Promise<void>;
  cancel: () => Promise<void>;
  create: (proposalId: string) => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const newClientKey = () => globalThis.crypto?.randomUUID?.() ?? `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const useChatStore = create<ChatStore>((set, get) => {
  const turn = (e: TurnEvent) => set((s) => ({ turn: chatTurn(s.turn, e) }));
  const commit = (e: CommitEvent) => set((s) => ({ commit: chatCommit(s.commit, e) }));
  const assistantOn = () => assistantOffCause(get().status) === null;

  /** Show a thread; `changed` = the fields a reply that just landed filled (sky marks, CH-4). */
  function show(thread: ChatThreadView, changed?: ChatRecipeBody['changed']) {
    set({ thread, error: null, refusal: null });
    useChatDraftStore.getState().hydrate(thread.id, thread, changed);
  }

  /** Read the open thread again; `settling` = the turn ended: a reply's filled fields get their marks. */
  async function refetch(settling = false): Promise<void> {
    const id = get().thread?.id;
    const thread = id ? await chatApi.chatThread(id).catch(() => null) : null;
    if (!thread || get().thread?.id !== id) return;
    const t = settling ? lastTurn(thread.messages, get().turn.messageId) : null;
    show(thread, t?.reply?.kind === 'recipe' ? (t.reply.body as ChatRecipeBody | null)?.changed : undefined);
    if (t) turn({ type: 'settled', ...t });
  }

  const { followTurn, followCommit, rehydrate } = chatPoll({
    turnState: () => get().turn, commitState: () => get().commit, turn, commit, refetch,
  });

  /** A thread opened: the turn and the take it left running carry on (a reload mid-turn, F-049). */
  async function open(load: () => Promise<ChatThreadView>): Promise<void> {
    await useChatDraftStore.getState().flush();
    set({ turn: INITIAL_TURN, commit: null });
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
      const started = await chatApi.startChatTurn(thread.id, t.lastText, t.clientKey);
      turn({ type: 'accepted', ...started });
      await refetch();
      void followTurn(started.jobId);
    } catch (err) {
      turn({ type: 'refused', error: message(err) });
    }
  }

  return {
    status: null, thread: null, turn: INITIAL_TURN, commit: null, error: null, refusal: null,

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

    send: async () => {
      if (!canSend(get().turn, assistantOn())) return;
      turn({ type: 'send', clientKey: newClientKey() });
      await post();
    },
    retry: async () => {
      if (!canRetry(get().turn, assistantOn())) return;
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
  };
});
