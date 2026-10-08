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
  + '"ops" holds each new op, and each pending op the request changes, in full; an op in ops replaces the pending op on the same '
  + 'target (SET_TEMPO, EDIT_STYLE, TRANSPOSE: the same kind; REHARMONIZE: overlapping bars; WRITE_PHRASE: the same start_bar; '
  + 'REPEAT or CUT: the same section; REWRITE_LYRICS: the same block), any other op is added.';
/** CP-C2 (R-040): qwen3:14b filled drop with "the ops this reply replaces" on 5 of 11 additions (run 1); a closing line
 * naming only the addition then kept every op on "forget all that" (r2). The block ends on both cases. */
export const CHAT_KEEP_LINE = '"drop" lists the pending ops the request takes away: "forget" or "remove" the X drops X (do not restate '
  + 'its old state); "forget all that" drops every pending op. A request that only adds ("also", "and", "do the same here") '
  + 'keeps every pending op: drop []. All numbers still mean the song as read above, not as the pending plan would leave it.';

/** The PENDING PLAN block of a chat turn: the dock's header and numbered ops, then the chat's reply lines (the last one
 * the dock's closing line with an addition's drop [] in front). */
export function chatPendingLines(plan: Pick<Plan, 'request' | 'ops' | 'verdicts' | 'revision'>): string[] {
  const lines = pendingLines(plan);
  return [...lines.slice(0, lines.length - REVISE_LINES.length), CHAT_REVISE_LINE, CHAT_KEEP_LINE];
}

/** The plan this turn revises, or null: no live edit card on the thread, its plan replaced (a dock PLAN, a render),
 * or the song changed since it was made (`fingerprint` is the song's now). */
export function pendingFor(threadId: string, songId: string, fingerprint: string): RevisePending | null {
  const card = liveEdit(threadId);
  const plan = getPlan(songId);
  if (!card || !plan || reviseRefusal(plan, card.planId, fingerprint)) return null;
  return { plan, lines: chatPendingLines(plan), count: plan.ops.length };
}
