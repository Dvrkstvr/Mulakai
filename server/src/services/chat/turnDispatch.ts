/**
 * A checked reply -> what the turn writes: the assistant message, and for a recipe the merged draft
 * (applyRecipe: a field touched after SEND is skipped and named, CH-6). What this version cannot do
 * becomes a plain `say` naming where it can be done, so a request is never silently dropped (D-098):
 * scalpel -> the Editor's verb, analyze -> Guided Create, edit -> SCORE in the Editor (D-110, until
 * CB-2), a recipe on a song thread -> NEW CHAT. Pure.
 */
import { applyRecipe } from './draftModel.js';
import type { AskBody, Draft, RecipeBody, ScalpelKind, TurnReply } from './chatTypes.js';

const VERB: Record<ScalpelKind, string> = { repaint: 'REPAINT', add_layer: 'ADD LAYER', split: 'SPLIT', export: 'EXPORT' };

export const REDIRECT = {
  scalpel: (kind: ScalpelKind) => `The chat cannot do that yet: open the song in the Editor and use ${VERB[kind]} there.`,
  analyze: 'The chat cannot read a reference song yet: use COVER in Guided Create, or describe the song you have in mind.',
  edit: 'The chat cannot change a song yet: open it in the Editor and use SCORE, which takes the same request.',
  noSong: 'There is no song to change yet: describe the song you want and I will propose one.',
  recipeOnSong: 'That sounds like a new song: press NEW CHAT to start one. This chat stays with this song.',
};

export interface DispatchInput {
  reply: TurnReply;
  hasSong: boolean;
  /** The draft as stored now (read in the same transaction as the write). */
  draft: Draft;
  /** The draft's rev when the person pressed SEND. */
  sentRev: number;
  /** Why the song's score cannot be read, else null. */
  scoreReason: string | null;
}

export type Dispatch =
  | { kind: 'say'; text: string; body: null }
  | { kind: 'ask'; text: string; body: AskBody }
  | { kind: 'recipe'; text: string; body: RecipeBody; draft: Draft };

const say = (text: string): Dispatch => ({ kind: 'say', text, body: null });

export function dispatchReply({ reply, hasSong, draft, sentRev, scoreReason }: DispatchInput): Dispatch {
  switch (reply.action) {
    case 'say': return say(reply.message);
    case 'ask': return { kind: 'ask', text: reply.message, body: { choices: reply.choices } };
    case 'scalpel': return say(REDIRECT.scalpel(reply.kind));
    case 'analyze': return say(REDIRECT.analyze);
    case 'edit':
      if (!hasSong) return say(REDIRECT.noSong);
      return say(scoreReason ? `${REDIRECT.edit} (Right now the score cannot be read: ${scoreReason}.)` : REDIRECT.edit);
    case 'recipe': {
      if (hasSong) return say(REDIRECT.recipeOnSong);
      const merged = applyRecipe(draft, reply.recipe, sentRev);
      return {
        kind: 'recipe', text: reply.message, draft: merged.draft,
        body: { recipe: reply.recipe, assumptions: reply.assumptions, changed: merged.changed, skipped: merged.skipped },
      };
    }
  }
}
