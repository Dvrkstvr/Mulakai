/**
 * The two drop guards of a revise turn (CP-C2, R-040; in the spirit of C1's asksWholeSong, D-201). qwen3:14b holds one
 * default for `drop`: run 1 dropped pending ops on additions ("and also transpose it up"), r2 and r3 kept every pending
 * op on "forget all that, just transpose it down a tone". The keep guard: the person's words carry no removal or
 * replacement intent and the reply drops a pending op that no returned op replaces on its target. The start-over guard:
 * the words start over and the reply keeps a pending op it neither drops nor replaces, or returns one unchanged. Each
 * sends the reply back once with a named reason; a second answer is the planner's and stands (the card shows it). Since
 * C2 live B2 a start over drops every pending op in code whatever `drop` says (replyCheck), so its guard is left with
 * the ops returned unchanged; one returned twice stands as SAME. Pure.
 */
import { sameOp, sameTarget } from '../score/planRevise.js';
import type { Op } from '../score/planTypes.js';

/** Words that ask to take something away or swap it (assumed list, English plus the commonest German and Spanish). */
const REMOVE_WORDS = new RegExp('\\b(forget|remove|drop|delete|undo|revert|cancel|scrap|scratch|ditch|lose|skip|cut|'
  + 'get rid|take (it |that |them )?(out|away|off)|instead|replace|rather|swap|start over|from scratch|only|just|'
  + 'no|not|don\'?t|without|fewer|less|back to|keep the rest|'
  + 'vergiss|statt|nur|ohne|weniger|nicht|olvida|en vez|solo|sin|menos)\\b', 'i');
/** Stems that take endings (removed, entfernen, löschen, quitar, eliminar). */
const REMOVE_STEMS = /\b(remov|delet|replac|entfern|lösch|quit|elimin)/i;
/** "that" / "this" / "it" only as the whole object: "scrap that, ..." starts over, "scrap that chorus" does not. */
const END = '(?=\\s*(?:$|[,.;:!?\\u2014-]|and\\b|just\\b|then\\b|only\\b|nur\\b))';
/** Words that throw the whole pending plan away (assumed list, same languages). */
const START_WORDS = new RegExp(`\\b(start (over|again|afresh)|from scratch|forget (about )?(everything|it all)|`
  + `(forget|scrap|ditch|drop|undo|never ?mind|instead of) (about )?(all (of )?)?(that|this|it|everything)${END}|`
  + `vergiss (das )?alles|von vorne|olvida (todo|eso)|desde cero)`, 'i');

/** The person's words ask to remove or replace something (then any drop stands). */
export const asksToRemove = (request: string): boolean => REMOVE_WORDS.test(request) || REMOVE_STEMS.test(request);
/** The person's words throw the whole pending plan away. */
export const startsOver = (request: string): boolean => START_WORDS.test(request);

/** The reasons a guarded retry is sent back with; turnCall spends each guard once it has been sent. */
export const KEEP_REASON = 'this request adds; keep every pending op: drop []';
export const START_REASON = 'this request starts over: drop every pending op';

const replaced = (op: Op, ops: Op[]) => ops.some((o) => sameTarget(o, op));
const named = (pending: Op[], ns: number[]) => ns.map((n) => `pending op ${n} ${pending[n - 1].op}`).join(', ');

/** The dropped pending op numbers that no returned op replaces on their target (1-based, ascending). */
export function lostDrops(pending: Op[], drop: number[], ops: Op[]): number[] {
  return [...new Set(drop)].filter((n) => pending[n - 1] && !replaced(pending[n - 1], ops)).sort((a, b) => a - b);
}

/** The keep guard's reason, or null: only when the request neither removes nor starts over and a drop loses ops. */
export function keepReason(request: string, pending: Op[], drop: number[], ops: Op[]): string | null {
  if (asksToRemove(request) || startsOver(request)) return null;
  const lost = lostDrops(pending, drop, ops);
  return lost.length ? `${KEEP_REASON} (your drop removed ${named(pending, lost)})` : null;
}

/** The start-over guard's reason, or null: only when the request starts over and a pending op is kept as it was:
 * neither dropped nor replaced, or returned unchanged (C2 live B2 (a): "start over: instead just change the tempo"
 * under a mark came back as the pending REHARMONIZE, unchanged, which counts as on its target). */
export function startOverReason(request: string, pending: Op[], drop: number[], ops: Op[]): string | null {
  if (!startsOver(request)) return null;
  const kept = pending.flatMap((op, k) => (ops.some((o) => sameOp(o, op)) || !(drop.includes(k + 1) || replaced(op, ops)) ? [k + 1] : []));
  return kept.length ? `${START_REASON} (your reply keeps ${named(pending, kept)})` : null;
}

/** A guard's reason in the person's words, for the card's refusal line (C2 live B6); null: not a guard's. */
export function guardWords(reason: string): string | null {
  const ops = [...reason.matchAll(/pending op \d+ ([A-Z_]+)/g)].map((m) => m[1].replace(/_/g, ' ')).join(', ');
  if (reason.startsWith(START_REASON)) return `the reply kept ${ops || 'pending changes'} though you asked to start over`;
  if (reason.startsWith(KEEP_REASON)) return `the reply dropped ${ops || 'pending changes'} though you only added`;
  return null;
}

/** The first reason among the unspent guards (`unspent`: their reason heads), or null. */
export function reviseGuard(request: string, pending: Op[], drop: number[], ops: Op[], unspent: string[]): string | null {
  const keep = unspent.includes(KEEP_REASON) ? keepReason(request, pending, drop, ops) : null;
  return keep ?? (unspent.includes(START_REASON) ? startOverReason(request, pending, drop, ops) : null);
}
