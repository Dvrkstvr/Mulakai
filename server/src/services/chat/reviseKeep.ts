/**
 * The additive-drop guard of a revise turn (CP-C2 r2, R-040; in the spirit of C1's asksWholeSong, D-201): qwen3:14b
 * fills `drop` with "the ops this reply replaces" even when the person only adds ("and also transpose it up"). When
 * the person's words carry no removal or replacement intent and the reply drops a pending op that no returned op
 * replaces on its target, the reply goes back once with a named reason; a second drop is the planner's answer and
 * stands (the card lists it REMOVED), so nothing is overridden silently. Pure.
 */
import { sameTarget } from '../score/planRevise.js';
import type { Op } from '../score/planTypes.js';

/** Words that ask to take something away or swap it (assumed list, English plus the commonest German and Spanish). */
const REMOVE_WORDS = new RegExp('\\b(forget|remove|drop|delete|undo|revert|cancel|scrap|scratch|ditch|lose|skip|cut|'
  + 'get rid|take (it |that |them )?(out|away|off)|instead|replace|rather|swap|start over|from scratch|only|just|'
  + 'no|not|don\'?t|without|fewer|less|back to|keep the rest|'
  + 'vergiss|statt|nur|ohne|weniger|nicht|olvida|en vez|solo|sin|menos)\\b', 'i');
/** Stems that take endings (removed, entfernen, löschen, quitar, eliminar). */
const REMOVE_STEMS = /\b(remov|delet|replac|entfern|lösch|quit|elimin)/i;

/** The person's words ask to remove or replace something (then any drop stands). */
export const asksToRemove = (request: string): boolean => REMOVE_WORDS.test(request) || REMOVE_STEMS.test(request);

/** The reason a guarded retry is sent back with; turnCall spends the guard once it has been sent. */
export const KEEP_REASON = 'this request adds; keep every pending op: drop []';

/** The dropped pending op numbers that no returned op replaces on their target (1-based, ascending). */
export function lostDrops(pending: Op[], drop: number[], ops: Op[]): number[] {
  return [...new Set(drop)].filter((n) => pending[n - 1] && !ops.some((o) => sameTarget(o, pending[n - 1]))).sort((a, b) => a - b);
}

/** The guard's reason for this reply, or null: only when the request does not ask to remove and a drop loses ops. */
export function keepReason(request: string, pending: Op[], drop: number[], ops: Op[]): string | null {
  if (asksToRemove(request)) return null;
  const lost = lostDrops(pending, drop, ops);
  return lost.length ? `${KEEP_REASON} (your drop removed ${lost.map((n) => `pending op ${n} ${pending[n - 1].op}`).join(', ')})` : null;
}
