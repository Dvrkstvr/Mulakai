/** One turn's life (scope.md "A turn, end to end", F-042, F-049): composing → sending → queued "STARTS AFTER n"
 * → thinking "attempt n of 3" → outcome | failed | offline | cancelled | interrupted. Built from the server's
 * `MessageView` (chat/messageView.ts) and the turn job's polls. Only this reducer moves a turn. Pure. */
import type { ChatFailedBody, ChatMessageView } from './api/chat';

export type TurnPhase =
  | { kind: 'composing' }
  /** POST turns in flight; a second SEND is ignored (one `clientKey` per message). */
  | { kind: 'sending' }
  | { kind: 'queued'; ahead: number }
  /** `note` is the retry's reason ("bar 5 had 31/32 units") or the unload. */
  | { kind: 'thinking'; attempt: number; note: string | null }
  /** The reply landed: a say, ask, recipe or edit message (`replyId`). */
  | { kind: 'outcome'; replyId: string | null }
  /** `cause`: `check` = 3 attempts spent; others (context short, unload not confirmed, …) name it in `reasons`. */
  | { kind: 'failed'; reasons: string[]; cause: string }
  /** The planner did not answer: ASSISTANT OFF with the cause, RETRY, FORM. */
  | { kind: 'offline'; cause: string }
  | { kind: 'cancelled' }
  /** The job vanished (server restart): the message stays, nothing was proposed. */
  | { kind: 'interrupted' };

export interface TurnState {
  phase: TurnPhase;
  /** The composer's text; kept through a refused POST, cleared once the server has the message. */
  text: string;
  /** The text of the last message sent, for RETRY / SEND AGAIN. */
  lastText: string;
  /** The idempotency key of the message being sent; kept through a refused POST so a resend is one turn. */
  clientKey: string | null;
  jobId: string | null;
  messageId: string | null;
  /** CANCEL pressed while queued or thinking; the server's answer ends it. */
  cancelling: boolean;
  /** A refused POST (queue full, the server down): a rust line over the composer. */
  error: string | null;
}

/** The fields of a `GET /api/generate/:jobId` poll this reducer reads. */
export interface TurnJobPoll {
  status: 'queued' | 'loading' | 'running' | 'done' | 'failed';
  queuePosition?: number;
  progressText?: string;
  cancelled?: boolean;
}

export type TurnEvent =
  | { type: 'type'; text: string }
  | { type: 'send'; clientKey: string }
  /** RETRY / SEND AGAIN: the last message's text as a new message. */
  | { type: 'retry'; clientKey: string }
  | { type: 'accepted'; jobId: string; messageId: string; position: number }
  | { type: 'refused'; error: string }
  | { type: 'poll'; job: TurnJobPoll }
  | { type: 'cancel' }
  /** The job ended: the user message and the reply after it, from a thread refetch. Also a reload's restore. */
  | { type: 'settled'; user: ChatMessageView; reply: ChatMessageView | null }
  /** The job is gone and the thread does not say how it ended (404, the server stopped answering). */
  | { type: 'lost' }
  | { type: 'reset' };

export const INITIAL_TURN: TurnState = {
  phase: { kind: 'composing' }, text: '', lastText: '', clientKey: null, jobId: null, messageId: null, cancelling: false, error: null,
};

export const MAX_TURN_ATTEMPTS = 3;
const ACTIVE = new Set<TurnPhase['kind']>(['sending', 'queued', 'thinking']);
const RETRYABLE = new Set<TurnPhase['kind']>(['failed', 'offline', 'interrupted']);
export const turnRunning = (s: TurnState): boolean => ACTIVE.has(s.phase.kind);
/** SEND is live: no turn running, text typed, the assistant on (F-043: no turn while ASSISTANT OFF). */
export const canSend = (s: TurnState, assistantOn: boolean): boolean => assistantOn && !turnRunning(s) && s.text.trim() !== '';
export const canRetry = (s: TurnState, assistantOn: boolean): boolean =>
  assistantOn && RETRYABLE.has(s.phase.kind) && s.lastText.trim() !== '';

/** "attempt 2 of 3 · bar 5 had 31/32 units" → 2 and the reason; other text (the unload) is a note. */
function thinking(prev: TurnPhase, text: string | undefined): TurnPhase {
  const attempt = prev.kind === 'thinking' ? prev.attempt : 1;
  const m = text?.match(/^attempt (\d+) of \d+(?: · (.*))?$/);
  if (m) return { kind: 'thinking', attempt: Number(m[1]), note: m[2] ?? null };
  return { kind: 'thinking', attempt, note: text ?? null };
}

/** Where a message the server has settled (or a reload restores) leaves the turn. */
function fromServer(user: ChatMessageView, reply: ChatMessageView | null): TurnPhase | null {
  switch (user.state) {
    case 'queued': return { kind: 'queued', ahead: 0 };
    case 'thinking': return { kind: 'thinking', attempt: 1, note: null };
    case 'cancelled': return { kind: 'cancelled' };
    case 'interrupted': return { kind: 'interrupted' };
    case 'failed': {
      const body = reply?.kind === 'failed' ? (reply.body as ChatFailedBody | null) : null;
      if (body?.cause === 'offline') return { kind: 'offline', cause: body.reasons[0] ?? reply!.text };
      return { kind: 'failed', reasons: body?.reasons.length ? body.reasons : [reply?.text || 'the turn failed'], cause: body?.cause ?? 'error' };
    }
    case 'done': return { kind: 'outcome', replyId: reply?.id ?? null };
    default: return null;
  }
}

export function chatTurn(s: TurnState, e: TurnEvent): TurnState {
  const k = s.phase.kind;
  switch (e.type) {
    case 'type': return { ...s, text: e.text, error: null };
    case 'send':
      if (turnRunning(s) || s.text.trim() === '') return s;
      return { ...s, phase: { kind: 'sending' }, lastText: s.text.trim(), clientKey: s.clientKey ?? e.clientKey, error: null };
    case 'retry':
      if (!RETRYABLE.has(k) || s.lastText.trim() === '') return s;
      return { ...s, phase: { kind: 'sending' }, clientKey: e.clientKey, error: null };
    case 'accepted':
      if (k !== 'sending') return s;
      return {
        ...s, text: s.text.trim() === s.lastText ? '' : s.text, clientKey: null, jobId: e.jobId, messageId: e.messageId, cancelling: false,
        phase: e.position > 0 ? { kind: 'queued', ahead: e.position } : { kind: 'thinking', attempt: 1, note: null },
      };
    case 'refused':
      return k === 'sending' ? { ...s, phase: { kind: 'composing' }, text: s.text || s.lastText, error: e.error } : s;
    case 'poll': {
      if (k !== 'queued' && k !== 'thinking') return s;
      const { job } = e;
      if (job.cancelled) return { ...s, phase: { kind: 'cancelled' }, cancelling: false };
      if (job.status === 'queued') return { ...s, phase: { kind: 'queued', ahead: job.queuePosition ?? (k === 'queued' ? s.phase.ahead : 1) } };
      if (job.status === 'loading' || job.status === 'running') return { ...s, phase: thinking(s.phase, job.progressText) };
      return s; // done / failed: the thread says how (settled)
    }
    case 'cancel': return k === 'queued' || k === 'thinking' ? { ...s, cancelling: true } : s;
    case 'settled': {
      const phase = fromServer(e.user, e.reply);
      if (!phase) return s;
      const ended = !ACTIVE.has(phase.kind);
      // Still running by the thread: the polls know the queue position and the attempt better.
      if (!ended && (k === 'queued' || k === 'thinking')) return { ...s, jobId: e.user.jobId ?? s.jobId, messageId: e.user.id };
      return {
        ...s, phase, jobId: e.user.jobId ?? s.jobId, messageId: e.user.id, lastText: e.user.text || s.lastText,
        cancelling: ended ? false : s.cancelling, clientKey: ended ? null : s.clientKey,
      };
    }
    case 'lost': return k === 'queued' || k === 'thinking' ? { ...s, phase: { kind: 'interrupted' }, cancelling: false } : s;
    case 'reset': return INITIAL_TURN;
  }
}

/** The last user message of a thread and the reply after it: what a reload restores and a settle reads. */
export function lastTurn(messages: ChatMessageView[], messageId?: string | null): { user: ChatMessageView; reply: ChatMessageView | null } | null {
  const i = messageId ? messages.findIndex((m) => m.id === messageId) : messages.findLastIndex((m) => m.role === 'user');
  if (i < 0) return null;
  const next = messages[i + 1];
  return { user: messages[i], reply: next?.role === 'assistant' ? next : null };
}

/** CREATE SONG's take (F-044): the line under the card, whose button never turns into progress. C0b adds APPLY's
 * render / splice phases here. Done → null: the song card that lands says the rest (TRUNCATED included). */
export type CommitPhase =
  | { kind: 'starting' } | { kind: 'queued'; ahead: number } | { kind: 'running'; progressText: string | null }
  /** The server refused (proposal gone, blockers, a model still loaded) or the take failed: the card is live again. */
  | { kind: 'failed'; error: string };
export interface CommitState { proposalId: string; jobId: string | null; phase: CommitPhase }
export type CommitEvent =
  | { type: 'start'; proposalId: string }
  | { type: 'started'; jobId: string }
  /** A reload found the card `committing` with its job. */
  | { type: 'restore'; proposalId: string; jobId: string }
  | { type: 'refused'; error: string }
  | { type: 'poll'; job: TurnJobPoll & { error?: string } };

export function chatCommit(s: CommitState | null, e: CommitEvent): CommitState | null {
  if (e.type === 'start') return s && s.phase.kind !== 'failed' ? s : { proposalId: e.proposalId, jobId: null, phase: { kind: 'starting' } };
  if (e.type === 'restore') return { proposalId: e.proposalId, jobId: e.jobId, phase: { kind: 'running', progressText: null } };
  if (!s) return s;
  switch (e.type) {
    case 'started': return { ...s, jobId: e.jobId, phase: { kind: 'queued', ahead: 0 } };
    case 'refused': return { ...s, jobId: null, phase: { kind: 'failed', error: e.error } };
    case 'poll': {
      const { job } = e;
      if (job.status === 'queued') return { ...s, phase: { kind: 'queued', ahead: job.queuePosition ?? 0 } };
      if (job.status === 'loading' || job.status === 'running') return { ...s, phase: { kind: 'running', progressText: job.progressText ?? null } };
      if (job.status === 'done' || job.cancelled) return null;
      return { ...s, jobId: null, phase: { kind: 'failed', error: job.error || 'the take failed' } };
    }
  }
}
