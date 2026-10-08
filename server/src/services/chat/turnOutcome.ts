/**
 * What a chat turn writes when it ends (turnJob's outcome, split out so a turn can end before the planner
 * loads): a failed turn's one `failed` message ({reasons, cause}), or the reply, the draft merge and the
 * proposal in one transaction, then the proposal (and an edit card's planStore plan) stored once the card
 * is written. A failed write stores nothing. A start over that left nothing (D-257) drops the plan it revised.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import { wasAborted, type Job } from '../jobRegistry.js';
import { dropPlan, getPlan, setPlan } from '../score/planStore.js';
import { appendMessage } from './messageStore.js';
import { propose, retireEdit } from './proposalStore.js';
import { threadById, writeDraft } from './threadStore.js';
import { dispatchReply, type AnalyzeResolved, type EditMark, type EditResolved } from './turnDispatch.js';
import type { TurnRefs } from './songStateSource.js';
import type { FailedBody, TurnReply } from './chatTypes.js';

/** `stale` (C1, D-175): the turn's mark went stale while it queued; it ended before the planner loaded. */
export type TurnCause = 'offline' | 'check' | 'context' | 'unload' | 'cancelled' | 'gone' | 'stale';

export class TurnError extends Error {
  constructor(readonly cause: TurnCause, message: string, readonly reasons: string[] = [message]) { super(message); }
}

export function writeFailed(threadId: string, reasons: string[], cause: TurnCause): void {
  const body: FailedBody = { reasons, cause };
  try {
    appendMessage(threadId, { role: 'assistant', kind: 'failed', text: reasons[0] ?? cause, body });
  } catch { /* the thread is gone (NEW CHAT): nothing to write to */ }
}

/** `scrap` (D-257): a start over left nothing to plan; the plan it revised goes once the reply is written. */
export type Resolved = { analyze: AnalyzeResolved | null; edit: EditResolved | null; request: string; mark?: EditMark | null;
  scrap?: { songId: string; planId: string } | null };

/** The reply, the draft merge and the proposal: all or nothing. */
const writeReply = db.transaction((threadId: string, reply: TurnReply, sentRev: number, scoreReason: string | null, refs: TurnRefs, r: Resolved) => {
  const now = threadById(threadId);
  if (!now) throw new TurnError('gone', 'this chat was cleared while the assistant was thinking');
  const out = dispatchReply({ reply, hasSong: Boolean(now.songId), draft: now.draft, sentRev, scoreReason, reference: refs.reading, ...r });
  if (out.kind === 'recipe' && out.draft !== now.draft && !writeDraft(threadId, now.draft.rev, out.draft).ok) {
    throw new TurnError('check', 'the draft changed while the reply was written');
  }
  const proposalId = out.kind === 'recipe' || out.kind === 'analyze' || out.kind === 'edit' ? crypto.randomUUID() : null;
  const { message } = appendMessage(threadId, { role: 'assistant', kind: out.kind, text: out.text, body: out.body, proposalId });
  return { message, proposalId, out };
});

/** Writes the reply, then stores its proposal (an edit's plan replaces the song's plan, D-028). */
export function commitReply(threadId: string, reply: TurnReply, sentRev: number, scoreReason: string | null, refs: TurnRefs, r: Resolved): void {
  const { message, proposalId, out } = writeReply(threadId, reply, sentRev, scoreReason, refs, r);
  const at = { threadId, messageId: message.id, createdAt: Date.now() };
  if (proposalId && out.kind === 'recipe') propose({ id: proposalId, ...at, kind: 'recipe', recipe: out.body.recipe });
  if (proposalId && out.kind === 'analyze') propose({ id: proposalId, ...at, kind: 'analyze', target: out.body.target });
  if (proposalId && out.kind === 'edit') { setPlan(out.plan); propose({ id: proposalId, ...at, kind: 'edit', planId: out.plan.id }); }
  if (r.scrap && getPlan(r.scrap.songId)?.id === r.scrap.planId) { dropPlan(r.scrap.songId); retireEdit(threadId); } // the dock clears
}

export function causeOf(job: Job, err: unknown): TurnCause {
  if (wasAborted(job)) return 'cancelled';
  if (err instanceof TurnError) return err.cause;
  return /still loaded|ollama stop/.test(err instanceof Error ? err.message : String(err)) ? 'unload' : 'offline';
}
