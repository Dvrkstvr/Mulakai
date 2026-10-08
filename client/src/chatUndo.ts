/** UNDO TURN and the just-filled marks on the client (F-059, D-220, D-221). The server decides and records: a recipe
 * reply's body holds `undo: {rev, before, fields}`, the message view says `undo: 'offer' | 'done'`. Here: which reply
 * shows UNDO TURN (or its after-line), and the ASSISTANT marks rebuilt from the latest recipe's record while no later
 * user message exists, so they survive a reload; a field touched by hand after the reply is YOURS instead. Pure. */
import type { ChatDraft, ChatDraftKey } from './api/chat';
import type { ChatMessageViewC2, ChatRecipeBodyC2, RecipeUndone } from './api/chatConverge';

/** The UNDO TURN line under a recipe reply: the button (held while a turn runs; the server refuses then too), the
 * after-line (`undone` null when the body has no detail), or nothing. */
export type UndoLine = { kind: 'offer'; disabled: boolean } | { kind: 'done'; undone: RecipeUndone | null } | null;

const recipeBody = (m: ChatMessageViewC2): ChatRecipeBodyC2 | null =>
  m.kind === 'recipe' && m.body ? (m.body as ChatRecipeBodyC2) : null;

export function undoLine(m: ChatMessageViewC2, songId: string | null, turnOpen: boolean): UndoLine {
  const body = recipeBody(m);
  if (!body?.undo || body.undo.fields.length === 0) return null;
  if (m.undo === 'done' || body.undone) return { kind: 'done', undone: body.undone ?? null };
  if (songId !== null || m.undo !== 'offer') return null;
  return { kind: 'offer', disabled: turnOpen };
}

/** The fields the last reply filled, with the value each replaced (null = was empty): the draft store's `filled`. */
export function justFilled(messages: ChatMessageViewC2[], draft: ChatDraft | null): Partial<Record<ChatDraftKey, { old: unknown }>> {
  const i = messages.findLastIndex((m) => m.kind === 'recipe');
  if (i < 0 || messages.slice(i + 1).some((m) => m.role === 'user')) return {};
  const m = messages[i];
  const body = recipeBody(m);
  if (!body?.undo || body.undone || m.undo === 'done') return {};
  const { rev, before, fields } = body.undo;
  const out: Partial<Record<ChatDraftKey, { old: unknown }>> = {};
  for (const k of fields) {
    if ((draft?.touched[k] ?? -1) > rev) continue;
    out[k] = { old: k in before ? before[k] : null };
  }
  return out;
}
