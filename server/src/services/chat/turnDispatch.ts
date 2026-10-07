/**
 * A checked reply -> what the turn writes: the assistant message, and for a recipe the merged draft
 * (applyRecipe: a field touched after SEND is skipped and named, CH-6). What this version cannot do
 * becomes a plain `say` naming where it can be done, so a request is never silently dropped (D-098):
 * scalpel -> the Editor's verb, a recipe or an analyze on a song thread -> NEW CHAT (D-130). C0b (CB-2):
 * an edit on a song is an edit card over a planStore plan built by the score agent's own planBuild,
 * with spliceEligibility's verdict (D-154); a song that cannot be edited gets the reason as a say
 * (F-046 edge). C3: an analyze on the draft thread is a READ card (or a say with why it cannot be read);
 * a recipe on a reading goes through referenceRecipe first, so code fills the borrowed fields (D-128).
 * Pure: turnJob resolves the analyze target and the edit's base, and stores the plan.
 */
import { buildPlan } from '../score/planBuild.js';
import type { ApplyResult, Plan } from '../score/planTypes.js';
import { applyRecipe } from './draftModel.js';
import { spliceEligibility } from './spliceEligibility.js';
import { referenceRecipe } from './referenceRecipe.js';
import type { Reading } from './reading.js';
import type { AnalyzeBody, AskBody, Draft, EditBase, EditBody, RecipeBody, ScalpelKind, TurnReply } from './chatTypes.js';

const VERB: Record<ScalpelKind, string> = { repaint: 'REPAINT', add_layer: 'ADD LAYER', split: 'SPLIT', export: 'EXPORT' };
const ATTACH = 'Attach the song with ATTACH ▾ (FILE… or FROM LIBRARY…) and send again.';

export const REDIRECT = {
  scalpel: (kind: ScalpelKind) => `The chat cannot do that yet: open the song in the Editor and use ${VERB[kind]} there.`,
  analyzeOnSong: 'Reading a reference starts a new song: press NEW CHAT and attach it there. This chat stays with this song.',
  analyzeMissing: (reason: string, attached: string[]) =>
    `I cannot read that: ${reason}. ${attached.length ? `Attached here: ${attached.map((n) => `"${n}"`).join(', ')}. ` : ''}${ATTACH}`,
  editRefused: (reason: string) => `I cannot plan a change to this song: ${reason}`,
  noSong: 'There is no song to change yet: describe the song you want and I will propose one.',
  recipeOnSong: 'That sounds like a new song: press NEW CHAT to start one. This chat stays with this song.',
};

/** An edit reply resolved by turnJob: the checked apply on an eligible song, or why it cannot be edited. */
export type EditResolved = { reason: string }
  | { base: EditBase; applied: ApplyResult; attempts: number; refusals: string[][]; planId: string; createdAt: number };

/** The analyze reply resolved by turnJob: the READ card, or why nothing can be read. */
export type AnalyzeResolved = { body: AnalyzeBody } | { reason: string; attached: string[] };

export interface DispatchInput {
  reply: TurnReply;
  hasSong: boolean;
  /** The draft as stored now (read in the same transaction as the write). */
  draft: Draft;
  /** The draft's rev when the person pressed SEND. */
  sentRev: number;
  /** Why the song's score cannot be read, else null. */
  scoreReason: string | null;
  /** C3: the reading a recipe builds on (the draft thread's), else null. */
  reference?: { id: string; reading: Reading } | null;
  /** C3: an analyze reply's target, resolved; absent = nothing could be resolved. */
  analyze?: AnalyzeResolved | null;
  /** C0b: an edit reply on a song thread, resolved; absent = the score could not be read (`scoreReason`). */
  edit?: EditResolved | null;
  /** The person's words, kept on the plan (the dock shows them). */
  request?: string;
}

export type Dispatch =
  | { kind: 'say'; text: string; body: null }
  | { kind: 'ask'; text: string; body: AskBody }
  | { kind: 'recipe'; text: string; body: RecipeBody; draft: Draft }
  | { kind: 'analyze'; text: string; body: AnalyzeBody }
  /** turnJob stores `plan` in planStore once the card is written (a failed write stores nothing). */
  | { kind: 'edit'; text: string; body: EditBody; plan: Plan };

const say = (text: string): Dispatch => ({ kind: 'say', text, body: null });

function analyzeCard(message: string, hasSong: boolean, analyze: AnalyzeResolved | null | undefined): Dispatch {
  if (hasSong) return say(REDIRECT.analyzeOnSong);
  if (!analyze) return say(REDIRECT.analyzeMissing('nothing is attached', []));
  if ('reason' in analyze) return say(REDIRECT.analyzeMissing(analyze.reason, analyze.attached));
  return { kind: 'analyze', text: message, body: analyze.body };
}

function editCard(reply: Extract<TurnReply, { action: 'edit' }>, request: string, edit: EditResolved | null | undefined, scoreReason: string | null): Dispatch {
  if (!edit || 'reason' in edit) return say(REDIRECT.editRefused(edit?.reason ?? scoreReason ?? 'its score could not be read'));
  const { base, applied } = edit;
  const plan = buildPlan({
    id: edit.planId, createdAt: edit.createdAt, songId: base.songId, source: base.source, request, facts: base.facts,
    chordsPresent: base.chordsPresent, ops: reply.ops, applied, attempts: edit.attempts, refusals: edit.refusals,
  });
  const body: EditBody = {
    planId: plan.id, ops: plan.ops, verdicts: plan.verdicts, checks: plan.checks,
    splice: spliceEligibility(plan.ops, base), renderMode: plan.renderMode,
    assumptions: reply.assumptions, attempts: plan.attempts, refusals: plan.refusals,
  };
  return { kind: 'edit', text: reply.message, body, plan };
}

export function dispatchReply({ reply, hasSong, draft, sentRev, scoreReason, reference, analyze, edit, request = '' }: DispatchInput): Dispatch {
  switch (reply.action) {
    case 'say': return say(reply.message);
    case 'ask': return { kind: 'ask', text: reply.message, body: { choices: reply.choices } };
    case 'scalpel': return say(REDIRECT.scalpel(reply.kind));
    case 'analyze': return analyzeCard(reply.message, hasSong, analyze);
    case 'edit':
      if (!hasSong) return say(REDIRECT.noSong);
      return editCard(reply, request, edit, scoreReason);
    case 'recipe': {
      if (hasSong) return say(REDIRECT.recipeOnSong);
      const built = reference ? referenceRecipe(reply.recipe, reference.reading, reference.id) : { recipe: reply.recipe, reference: null };
      const merged = applyRecipe(draft, built.recipe, sentRev, built.reference);
      return {
        kind: 'recipe', text: reply.message, draft: merged.draft,
        body: {
          recipe: built.recipe, assumptions: reply.assumptions, changed: merged.changed, skipped: merged.skipped,
          ...(built.reference ? { reference: built.reference } : {}),
        },
      };
    }
  }
}
