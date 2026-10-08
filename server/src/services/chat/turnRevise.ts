/**
 * REVISE as a follow-up turn (F-058, D-227, docs/decisions/0010): no button, no flag. A turn on a song thread
 * whose live edit card still holds the song's pending plan (planStore id) on the song as read (fingerprint)
 * revises that plan: the planner sees its numbered ops (the dock's `pendingLines`) and answers an edit with
 * `drop` and only what changes; code merges it (reviseReply / planRevise). The chat's closing lines replace the
 * dock's, since here the reply is an edit action, and override the rules' "send the complete op list" (Q-050:
 * a restated plan loses ops). Not pure: reads the proposal and plan stores.
 */
import { getPlan } from '../score/planStore.js';
import { pendingLines, reviseRefusal, REVISE_LINES } from '../score/planRevise.js';
import type { Plan } from '../score/planTypes.js';
import { liveEdit } from './proposalStore.js';
import type { RevisePending } from './convergeTypes.js';

export const CHAT_REVISE_LINE = 'An edit reply changes this pending plan, so answer with only what changes, not the complete op list: '
  + '"drop" lists the numbers of pending ops to remove; "ops" holds each new op, and each pending op the request changes, in full. '
  + 'An op in ops replaces the pending op on the same target (SET_TEMPO, EDIT_STYLE, TRANSPOSE: the same kind; REHARMONIZE: '
  + 'overlapping bars; WRITE_PHRASE: the same start_bar; REPEAT or CUT: the same section; REWRITE_LYRICS: the same block); '
  + 'any other op is added. To start over, drop every pending op and return the new ones.';

/** The PENDING PLAN block of a chat turn: the dock's header and numbered ops, then the chat's reply lines. */
export function chatPendingLines(plan: Pick<Plan, 'request' | 'ops' | 'verdicts' | 'revision'>): string[] {
  const lines = pendingLines(plan);
  return [...lines.slice(0, lines.length - REVISE_LINES.length), CHAT_REVISE_LINE, REVISE_LINES[1]];
}

/** The plan this turn revises, or null: no live edit card on the thread, its plan replaced (a dock PLAN, a render),
 * or the song changed since it was made (`fingerprint` is the song's now). */
export function pendingFor(threadId: string, songId: string, fingerprint: string): RevisePending | null {
  const card = liveEdit(threadId);
  const plan = getPlan(songId);
  if (!card || !plan || reviseRefusal(plan, card.planId, fingerprint)) return null;
  return { plan, lines: chatPendingLines(plan), count: plan.ops.length };
}
