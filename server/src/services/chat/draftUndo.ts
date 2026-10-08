/**
 * UNDO TURN (F-059, D-220), pure: the draft and a recipe message's body -> the draft with that turn's fields put
 * back, or why not. A field comes back only when it still holds the turn's value and has no hand edit after the
 * turn's `rev`; any other is kept and named ("kept LYRICS: you changed it"). An undo is not a hand edit: `touched`
 * stays, the rev grows once when a field came back. Refused on a song thread, while a turn is open, without a
 * record (a turn that filled nothing, a message from before C2) and once undone. The route writes the draft and
 * the body's `undone` in one transaction (routes/chat.ts).
 */
import { recipeFields } from './draftModel.js';
import type { Draft, DraftField, DraftFields, RecipeBody } from './chatTypes.js';
import type { RecipeUndone, UndoKept, UndoResult } from './convergeTypes.js';

export const KEPT_HAND = 'you changed it';
export const KEPT_LATER = 'a later reply changed it';
export const REFUSED = {
  song: 'the song exists: UNDO TURN only works on the draft before CREATE SONG',
  open: 'a reply is in progress: wait for it, or CANCEL it, then UNDO TURN',
  none: 'this reply filled no field, so there is nothing to undo',
  done: 'this turn was already undone',
} as const;

export interface UndoContext { hasSong: boolean; busy: boolean }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const without = (list: DraftField[] | undefined, names: DraftField[]) => list && list.filter((f) => !names.includes(f));
const refuse = (error: 'UNDO_REFUSED' | 'TURN_OPEN', reason: string): UndoResult => ({ ok: false, error, reason });

export function draftUndo(draft: Draft, body: RecipeBody | null, ctx: UndoContext): UndoResult {
  if (ctx.hasSong) return refuse('UNDO_REFUSED', REFUSED.song);
  if (ctx.busy) return refuse('TURN_OPEN', REFUSED.open);
  const undo = body?.undo;
  if (!body || !undo || !Array.isArray(undo.fields) || undo.fields.length === 0) return refuse('UNDO_REFUSED', REFUSED.none);
  if (body.undone) return refuse('UNDO_REFUSED', REFUSED.done);

  const turn = recipeFields(body.recipe) as Record<string, unknown>;
  const fields: Record<string, unknown> = { ...draft.fields };
  const restored: DraftField[] = [];
  const kept: UndoKept[] = [];
  for (const field of undo.fields) {
    if ((draft.touched[field] ?? -1) > undo.rev) kept.push({ field, reason: KEPT_HAND });
    else if (!same(draft.fields[field], turn[field])) kept.push({ field, reason: KEPT_LATER });
    else {
      if (field in undo.before) fields[field] = undo.before[field];
      else delete fields[field];
      restored.push(field);
    }
  }
  if (restored.length === 0) return { ok: true, draft, restored, kept };
  const marks = draft.reference ? { borrowed: without(draft.borrowed, restored), missing: without(draft.missing, restored) } : {};
  const next: Draft = { ...draft, ...marks, rev: draft.rev + 1, fields: fields as DraftFields };
  return { ok: true, draft: next, restored, kept };
}

/** What the recipe body stores once undone (`at`: ms since the epoch). */
export const undoneRecord = (r: Extract<UndoResult, { ok: true }>, at: number): RecipeUndone => ({ at, restored: r.restored, kept: r.kept });
