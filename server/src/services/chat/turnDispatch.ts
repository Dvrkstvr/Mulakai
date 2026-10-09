/**
 * A checked reply -> what the turn writes: the assistant message, and for a recipe the merged draft
 * (applyRecipe: a field touched after SEND is skipped and named, CH-6). What this version cannot do
 * becomes a plain `say` naming where it can be done, so a request is never silently dropped (D-098):
 * scalpel -> the Editor's verb, a recipe or an analyze on a song thread -> NEW CHAT (D-130). C0b (CB-2):
 * an edit on a song is an edit card over a planStore plan built by the score agent's own planBuild,
 * with spliceEligibility's verdict (D-154); a song that cannot be edited gets the reason as a say
 * (F-046 edge). C3: an analyze on the draft thread is a READ card (or a say with why it cannot be read);
 * a recipe on a reading goes through referenceRecipe first, so code fills the borrowed fields (D-128).
 * C2: an edit card carries its bar map (barMap, D-215); a recipe that filled a field stores its undo record (D-220);
 * a revise turn's card is plan n+1 with `revision` and `since` (NEW / CHANGED / SAME, REMOVED; F-058, D-227).
 * RT-6 (F-094): a routed RE-TIME is the dock's plan as an edit card, or the re-timed reading as a say whose body
 * carries UNDO TURN's facts, or the refusal as a say.
 * Pure: turnJob resolves the analyze target, the edit's base and a RE-TIME, and stores the plan.
 */
import { buildPlan } from '../score/planBuild.js';
import type { ApplyResult, Plan, Since } from '../score/planTypes.js';
import { applyRecipe } from './draftModel.js';
import { barMap } from './barMap.js';
import { spliceEligibility } from './spliceEligibility.js';
import { asksWholeSong, assumptionsUnderMark, markFit } from './markFit.js';
import { referenceRecipe } from './referenceRecipe.js';
import type { Reading } from './reading.js';
import { refusedLine, retimeDoneLine } from './retimeReply.js';
import type { RetimeResolved } from './turnRetime.js';
import type { AnalyzeBody, AskBody, Draft, EditBase, EditBody, RecipeBody, ScalpelKind, TurnReply } from './chatTypes.js';
import type { RetimeDoneBody } from './editTypes.js';

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

/** An edit reply resolved by turnJob: the checked apply on an eligible song, or why it cannot be edited.
 * `revision` / `since`: a revise of the pending plan (absent = a fresh plan, revision 1). */
export type EditResolved = { reason: string }
  | { base: EditBase; applied: ApplyResult; attempts: number; refusals: string[][]; planId: string; createdAt: number; revision?: number; since?: Since };

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
  /** C1 (F-055): the turn's pinned mark (bars clamped to the score, null = a time only) and the clamp's notes. */
  mark?: EditMark | null;
  /** RT-6: an accepted RETIME, resolved after the unload. */
  retime?: RetimeResolved | null;
}
export type EditMark = NonNullable<EditBody['mark']>;

export type Dispatch =
  | { kind: 'say'; text: string; body: null }
  | { kind: 'say'; text: string; body: RetimeDoneBody }
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

function editCard(reply: Extract<TurnReply, { action: 'edit' }>, request: string, edit: EditResolved | null | undefined, scoreReason: string | null, mark?: EditMark | null): Dispatch {
  if (!edit || 'reason' in edit) return say(REDIRECT.editRefused(edit?.reason ?? scoreReason ?? 'its score could not be read'));
  const { base, applied } = edit;
  const plan = buildPlan({
    id: edit.planId, createdAt: edit.createdAt, songId: base.songId, source: base.source, request, facts: base.facts,
    chordsPresent: base.chordsPresent, ops: reply.ops, applied, attempts: edit.attempts, refusals: edit.refusals,
    revision: edit.since ? edit.revision : undefined, since: edit.since ?? null,
  });
  return { kind: 'edit', text: reply.message, body: editBody(plan, base, reply.assumptions, request, mark), plan };
}

/** The edit card's body over a plan (an edit turn's, or the dock's RE-TIME plan). */
function editBody(plan: Plan, base: EditBase, assumptions: string[], request: string, mark?: EditMark | null): EditBody {
  return {
    planId: plan.id, ops: plan.ops, verdicts: plan.verdicts, checks: plan.checks,
    splice: spliceEligibility(plan.ops, base), renderMode: plan.renderMode,
    assumptions: mark?.bars ? assumptionsUnderMark(assumptions) : assumptions, attempts: plan.attempts, refusals: plan.refusals,
    ...(mark ? { mark: { ...mark, notes: [...mark.notes, ...(mark.bars ? markFit(plan.ops, mark.bars, base.facts, asksWholeSong(request)).notes : [])] } } : {}),
    from: { bpm: base.facts.header.bpm, key: base.facts.header.key },
    map: barMap(base.facts, plan.ops),
    ...(plan.since ? { revision: plan.revision, since: plan.since } : {}),
  };
}

function retimeCard(reply: TurnReply, r: RetimeResolved, request: string): Dispatch {
  if (r.kind === 'refused') return say(refusedLine(r.reason));
  if (r.kind === 'reading') return { kind: 'say', text: retimeDoneLine(r.done), body: { retime: r.done } };
  const assumptions = reply.action === 'edit' ? reply.assumptions : [];
  return { kind: 'edit', text: reply.message, body: editBody(r.plan, r.base, assumptions, request), plan: r.plan };
}

export function dispatchReply({ reply, hasSong, draft, sentRev, scoreReason, reference, analyze, edit, request = '', mark, retime }: DispatchInput): Dispatch {
  if (retime && hasSong) return retimeCard(reply, retime, request);
  switch (reply.action) {
    case 'say': return say(reply.message);
    case 'ask': return { kind: 'ask', text: reply.message, body: { choices: reply.choices } };
    case 'scalpel': return say(REDIRECT.scalpel(reply.kind));
    case 'analyze': return analyzeCard(reply.message, hasSong, analyze);
    case 'edit':
      if (!hasSong) return say(REDIRECT.noSong);
      return editCard(reply, request, edit, scoreReason, mark);
    case 'recipe': {
      if (hasSong) return say(REDIRECT.recipeOnSong);
      const built = reference ? referenceRecipe(reply.recipe, reference.reading, reference.id) : { recipe: reply.recipe, reference: null };
      const merged = applyRecipe(draft, built.recipe, sentRev, built.reference);
      return {
        kind: 'recipe', text: reply.message, draft: merged.draft,
        body: {
          recipe: built.recipe, assumptions: reply.assumptions, changed: merged.changed, skipped: merged.skipped,
          ...(built.reference ? { reference: built.reference } : {}),
          ...(merged.changed.length ? { undo: { rev: merged.draft.rev, before: merged.before, fields: merged.changed } } : {}),
        },
      };
    }
  }
}
