/**
 * The open chat thread (F-041, F-042, F-044, F-049): its messages, the turn being sent (a `clientKey` per message),
 * CANCEL, CREATE SONG, and polling both jobs with the existing POLL_MS. Every turn and take change goes through
 * `chatTurn` / `chatCommit`; the draft is `chatDraftStore`. Jobs outlive the tab: opening a thread rehydrates them.
 */
import { create } from 'zustand';
import { api, ApiError } from './api';
import { chatApi, type ChatRecipeBody, type ChatStatus, type ChatThreadView } from './api/chat';
import { assistantOffCause } from './chatEntry';
import { useChatDraftStore } from './chatDraftStore';
import {
  INITIAL_TURN, canRetry, canSend, chatCommit, chatTurn, lastTurn, turnRunning,
  type CommitEvent, type CommitState, type TurnEvent, type TurnState,
} from './chatTurn';
import { POLL_MS } from './transcribeStore';

/** Failed polls in a row before a turn reads as interrupted (the server stopped answering). */
const MAX_POLL_STRIKES = 5;

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
const sleep = () => new Promise((r) => setTimeout(r, POLL_MS));
const newClientKey = () => globalThis.crypto?.randomUUID?.() ?? `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const following = new Map<string, symbol>();

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

  /** The turn's job ended (or vanished): the thread says how. */
  async function settle(lost: boolean): Promise<void> {
    await refetch(true);
    if (lost && turnRunning(get().turn)) turn({ type: 'lost' });
  }

  /** Poll one job until `alive` says it is no longer followed; `onPoll` returns true once it has ended. */
  async function follow(jobId: string, alive: () => boolean, onPoll: (job: Awaited<ReturnType<typeof api.jobStatus>>) => Promise<boolean>, onLost: () => Promise<void>) {
    const token = Symbol(jobId); // a newer follow of the same job (a reopen) takes over; this loop then ends
    following.set(jobId, token);
    const mine = () => following.get(jobId) === token && alive();
    let strikes = 0;
    try {
      while (mine()) {
        await sleep();
        if (!mine()) return;
        try {
          const job = await api.jobStatus(jobId);
          strikes = 0;
          if (await onPoll(job)) return;
        } catch (err) {
          if ((err instanceof ApiError && err.status === 404) || ++strikes >= MAX_POLL_STRIKES) return void (await onLost());
        }
      }
    } finally {
      if (following.get(jobId) === token) following.delete(jobId);
    }
  }

  const followTurn = (jobId: string) => follow(jobId, () => turnRunning(get().turn) && get().turn.jobId === jobId, async (job) => {
    turn({ type: 'poll', job });
    if (job.status !== 'done' && job.status !== 'failed') return false;
    await settle(false);
    return true;
  }, () => settle(true));

  const followCommit = (jobId: string) => follow(jobId, () => get().commit?.jobId === jobId, async (job) => {
    commit({ type: 'poll', job });
    if (job.status !== 'done' && job.status !== 'failed') return false;
    await refetch(); // the song card, and the draft thread is now the song's
    return true;
  }, async () => { commit({ type: 'poll', job: { status: 'failed', error: 'the server lost the take: look in the Library' } }); });

  /** A thread opened: the turn and the take it left running carry on (a reload mid-turn, F-049). */
  async function open(load: () => Promise<ChatThreadView>): Promise<void> {
    await useChatDraftStore.getState().flush();
    set({ turn: INITIAL_TURN, commit: null });
    try {
      const thread = await load();
      show(thread);
      const t = lastTurn(thread.messages);
      if (t) turn({ type: 'settled', ...t });
      const { jobId } = get().turn;
      if (t?.user.job && turnRunning(get().turn)) turn({ type: 'poll', job: t.user.job }); // its queue place / attempt now
      if (jobId && turnRunning(get().turn)) void followTurn(jobId);
      const card = thread.messages.find((m) => m.state === 'committing' && m.jobId && m.proposalId);
      if (card) {
        commit({ type: 'restore', proposalId: card.proposalId!, jobId: card.jobId! });
        if (card.job && card.job.status !== 'done' && card.job.status !== 'failed') commit({ type: 'poll', job: card.job });
        void followCommit(card.jobId!);
      }
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
