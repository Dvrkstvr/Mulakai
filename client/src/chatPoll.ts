/**
 * The chat's job polling (D-136, moved out of `chatStore.ts`): the turn's job and CREATE SONG's take, polled with
 * the existing POLL_MS, and a reopened thread's rehydration (the turn and take it left running carry on, F-049);
 * C3: a reading card's job, the reading and then its follow-up turn (`chatReading`).
 * Every state change still goes through `chatTurn` / `chatCommit`; the store hands in its getters and setters.
 */
import { api, ApiError } from './api';
import type { ChatThreadView } from './api/chat';
import { cardRunning, runningCards, type ReadingEvent, type ReadingState } from './chatReading';
import {
  lastTurn, turnRunning, type CommitEvent, type CommitState, type TurnEvent, type TurnState,
} from './chatTurn';
import { POLL_MS } from './transcribeStore';

/** Failed polls in a row before a turn reads as interrupted (the server stopped answering). */
const MAX_POLL_STRIKES = 5;

export type JobPoll = Awaited<ReturnType<typeof api.jobStatus>>;

export interface ChatPollDeps {
  turnState: () => TurnState;
  commitState: () => CommitState | null;
  readingState: () => ReadingState;
  turn: (e: TurnEvent) => void;
  commit: (e: CommitEvent) => void;
  reading: (e: ReadingEvent) => void;
  /** Read the open thread again; `settling` = the turn ended; `afterCard` = a reading card's job ended (its
   * follow-up reply's fields get their marks). */
  refetch: (settling?: boolean, afterCard?: string) => Promise<void>;
  /** A take this tab followed was saved (CREATE SONG's v1, an APPLY's version): the chat's player plays it. */
  landed?: () => void;
}

const sleep = () => new Promise((r) => setTimeout(r, POLL_MS));
const following = new Map<string, symbol>();

/** Poll one job until `alive` says it is no longer followed; `onPoll` returns true once it has ended. */
export async function follow(jobId: string, alive: () => boolean, onPoll: (job: JobPoll) => Promise<boolean>, onLost: () => Promise<void>) {
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

export function chatPoll(d: ChatPollDeps) {
  /** The turn's job ended (or vanished): the thread says how. */
  async function settle(lost: boolean): Promise<void> {
    await d.refetch(true);
    if (lost && turnRunning(d.turnState())) d.turn({ type: 'lost' });
  }

  const followTurn = (jobId: string) => follow(jobId, () => turnRunning(d.turnState()) && d.turnState().jobId === jobId, async (job) => {
    d.turn({ type: 'poll', job });
    if (job.status !== 'done' && job.status !== 'failed') return false;
    await settle(false);
    return true;
  }, () => settle(true));

  const followCommit = (jobId: string) => follow(jobId, () => d.commitState()?.jobId === jobId, async (job) => {
    d.commit({ type: 'poll', job });
    if (job.status !== 'done' && job.status !== 'failed') return false;
    await d.refetch(); // the song card, and the draft thread is now the song's
    if (job.status === 'done') d.landed?.();
    return true;
  }, async () => { d.commit({ type: 'poll', job: { status: 'failed', error: 'the server lost the take: look in the Library' } }); });

  /** A reading card's job: the reading, then (its job id moves) the follow-up turn the server queued (D-129). */
  const followCard = (messageId: string, jobId: string) => follow(jobId, () => {
    const c = d.readingState().cards[messageId];
    return cardRunning(c) && c.jobId === jobId;
  }, async (job) => {
    d.reading({ type: 'poll', messageId, job });
    if (job.status !== 'done' && job.status !== 'failed') return false;
    await d.refetch(false, messageId);
    followCards();
    return true;
  }, async () => { d.reading({ type: 'lost', messageId }); });

  /** Follow every running reading card's job not followed yet (after READ, a refetch, a reload). */
  function followCards(): void {
    for (const { messageId, jobId } of runningCards(d.readingState())) if (!following.has(jobId)) void followCard(messageId, jobId);
  }

  /** A thread just shown: restore its last turn and the card committing, and follow their jobs again. */
  function rehydrate(thread: ChatThreadView): void {
    const t = lastTurn(thread.messages);
    if (t) d.turn({ type: 'settled', ...t });
    const { jobId } = d.turnState();
    if (t?.user.job && turnRunning(d.turnState())) d.turn({ type: 'poll', job: t.user.job }); // its queue place / attempt now
    if (jobId && turnRunning(d.turnState())) void followTurn(jobId);
    const card = thread.messages.find((m) => m.state === 'committing' && m.jobId && m.proposalId);
    if (card) {
      d.commit({ type: 'restore', proposalId: card.proposalId!, jobId: card.jobId!, apply: card.kind === 'edit', phase: card.phase });
      if (card.job && card.job.status !== 'done' && card.job.status !== 'failed') d.commit({ type: 'poll', job: card.job });
      void followCommit(card.jobId!);
    }
    followCards();
  }

  return { followTurn, followCommit, followCards, rehydrate };
}
