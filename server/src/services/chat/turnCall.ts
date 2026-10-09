/**
 * THE LADDER SEAM (architecture.md "Chat (C0)", docs/decisions/0006): how many model calls a turn
 * makes lives here and nowhere else. `decideReply` returns a checked reply (or the reasons) whatever
 * the number of calls. Rung 0 (default, SP-5's base): one call with the full schema. Rung 2: the
 * same call offering only what the state allows (turnActions). Rung 1 (router + per-action call) is
 * not built and runs as rung 0; `CHAT_LADDER` picks 0 or 2 for the actions. Rung 3 (LD, F-095, D-234)
 * is built and always on for recipes: the recipe call writes no lines; a passed recipe then gets them
 * (turnLyrics, code decides keep vs write, D-252): the draft's when kept, else a lyrics call on the
 * language's model (`lyricsModel`, lyricsModels.ts), up to 3 attempts; lyrics that fail fail the turn.
 * SP-5's call settings: max_tokens 4000 when the reply may be an edit (2000 cut a 40-bar REHARMONIZE
 * three times; a recipe needs under 800), 1200 for the lyrics (D-259), temperature 0.3, reasoning off
 * and the strict schema (plannerClient). C2 (F-058, D-227): with a pending plan (`revise`) an edit is that
 * plan's revise: `drop` in the schema, the PENDING PLAN lines in the prompt, the merge checked by
 * replyCheck; the accepted merge comes back as `since`. An additive drop, or a start over that keeps
 * pending ops, goes back once (reviseKeep's guards, each spent on its first refusal); a start over left with nothing is
 * a say, `scrapped` (D-257). Pure (I/O injected).
 */
import type { ApplyResult, ChatMessage as PromptMessage, Op, PlannerReply, ScoreFacts, Since } from '../score/planTypes.js';
import { turnSchema } from './actionSchema.js';
import { chatRules } from './chatRules.js';
import { checkReply } from './replyCheck.js';
import { guardWords, KEEP_REASON, START_REASON } from './reviseKeep.js';
import { shownReviseReason } from '../score/reviseReply.js';
import { asksWholeSong, nothingPlanned, replanMessage } from './markFit.js';
import { detectLanguage } from './lyricLanguage.js';
import { draftLines } from './songState.js';
import { allowedActions, redirected, type TurnState } from './turnActions.js';
import { turnAttempts, type TurnOutcome } from './turnAttempts.js';
import { turnMessages } from './turnPrompt.js';
import { recipeLyrics } from './turnLyrics.js';
import { phraseBarsOf } from '../score/phraseRequest.js';
import type { ChatMessage, DraftFields, LyricsMode } from './chatTypes.js';
import type { RevisePending } from './convergeTypes.js';

export const BUILT_RUNGS = [0, 2];

/** The reasons as the person reads them (the card's refusal lines, a failed turn's line); the planner got them as written. */
function shownReasons(reasons: string[]): string[] {
  const shown = reasons.flatMap((r) => { const w = guardWords(r) ?? shownReviseReason(r); return w === null ? [] : [w]; });
  return shown.length ? shown : reasons;
}
/** Completion tokens per call (SP-5): an edit-capable call needs room for 6 ops of chords. Lyrics (F-095, D-259): SP-7's
 * longest reply was 638 tokens (gemma4 median 286); 1200 is ~2x that, and a reply cut there is retried (lyricsAttempts). */
export const MAX_TOKENS = { edit: 4000, other: 2000, lyrics: 1200 };

/** The rung from `CHAT_LADDER`; unset, unknown or not built = 0. */
export function ladderRung(raw: string | undefined = process.env.CHAT_LADDER): number {
  const n = Number(raw ?? 0);
  return BUILT_RUNGS.includes(n) ? n : 0;
}

export interface TurnContext {
  state: TurnState;
  /** songState's block. */
  block: string[];
  facts: ScoreFacts | null;
  request: string;
  /** A recipe card is live on this (draft) thread. */
  pending: boolean;
  /** The draft thread's fields (the card with the person's hand edits); null on a song thread. */
  draft: DraftFields | null;
  history: ChatMessage[];
  /** C1 (F-055): a pinned mark's prompt lines and its bars clamped to the score (null: a time only). */
  mark?: { lines: string[]; range: [number, number] | null } | null;
  /** C2 (F-058): the live edit card's plan this turn revises (turnRevise.pendingFor); null = a fresh plan. */
  revise?: RevisePending | null;
}

export interface CallDeps {
  /** `model`: absent = the planner; set = the lyrics model this call runs on (the caller loads it). */
  ask: (messages: PromptMessage[], schema: Record<string, unknown>, opts: { maxTokens: number; model?: string }) => Promise<PlannerReply>;
  /** LD: the lyrics model for a recipe's language; absent = the planner's own (no model passed). */
  lyricsModel?: (language: string) => string;
  /** LD: lyrics attempt n starts on `model` (undefined = the planner's). */
  onLyrics?: (model: string | undefined, n: number, reason?: string) => void;
  /** yue-server's apply for an edit (CB-2); absent = ops are checked by shape and bounds only. */
  apply?: (ops: Op[]) => Promise<ApplyResult>;
  onAttempt?: (n: number, reason?: string) => void;
  rung?: number;
}

/** `since`: an accepted revise's merge against the pending plan (NEW / CHANGED / SAME, REMOVED); null otherwise.
 * `scrapped` (D-257): a start over left nothing to plan; the reply is a say naming why, and the pending plan goes.
 * `lyrics`: a recipe's lyrics step (LD): kept or written, on which model, in how many attempts. */
export type Decision = TurnOutcome & { calls: number; messages: PromptMessage[]; since: Since | null; scrapped?: boolean;
  lyrics?: { mode: LyricsMode; model?: string; attempts: number } };

export async function decideReply(ctx: TurnContext, deps: CallDeps): Promise<Decision> {
  const allowed = allowedActions(ctx.state, deps.rung ?? 0);
  const phraseBars = phraseBarsOf(ctx.request);
  const reference = Boolean(ctx.state.referenceRead); // C3: reference_use and its rule only with a reading (D-128)
  const markRange = ctx.mark?.range ?? null;
  const markWhole = markRange ? asksWholeSong(ctx.request) : false; // C1 live B2: a mark bounds whole-song ops too
  const revise = ctx.facts ? ctx.revise ?? null : null;
  const schema = turnSchema({ facts: ctx.facts, phraseBars, allowed, reference, barRange: markRange, wholeSong: markWhole, pendingCount: revise?.count });
  const pending = revise ? revise.lines : draftLines(ctx.draft, ctx.pending);
  const messages = turnMessages({ rules: chatRules(allowed, { reference }), state: ctx.block, facts: ctx.facts, request: ctx.request, pending, history: ctx.history, mark: ctx.mark?.lines });
  const checkCtx = { allowed, shapeOnly: redirected(ctx.state), facts: ctx.facts, phraseBars, request: ctx.request, markRange, markWhole, pending: revise?.plan.ops };
  const maxTokens = allowed.includes('edit') ? MAX_TOKENS.edit : MAX_TOKENS.other;
  let calls = 0;
  let since: Since | null = null; // the last accepted check's merge: turnAttempts returns on it
  let scrapped = false; // D-257: the last accepted check was a start over that left nothing
  let guards = revise ? [KEEP_REASON, START_REASON] : []; // CP-C2: each drop guard sends a reply back once, then it stands
  const outcome = await turnAttempts(messages, {
    ask: (msgs) => { calls += 1; return deps.ask(msgs, schema, { maxTokens }); },
    check: async (json) => {
      const c = await checkReply(json, { ...checkCtx, guards }, { apply: deps.apply, language: detectLanguage });
      if (!c.ok) guards = guards.filter((g) => !c.reasons.some((r) => r.startsWith(g)));
      since = c.ok && c.revised && revise ? { planId: revise.plan.id, ...c.revised } : null;
      scrapped = Boolean(c.ok && c.scrapped);
      return c;
    },
    onAttempt: deps.onAttempt,
  });
  if (outcome.ok && outcome.reply.action === 'edit' && markRange) { // C1 re-check N2 / C2 live B2 (a): the card and its sentence agree
    outcome.reply = { ...outcome.reply, message: replanMessage(outcome.reply.message, outcome.reply.ops, outcome.refusals, markWhole ? '' : ctx.request) };
  }
  if (outcome.ok && scrapped) outcome.reply = { action: 'say', message: nothingPlanned(outcome.refusals, markRange && !markWhole ? ctx.request : '') };
  if (outcome.ok) outcome.refusals = outcome.refusals.map(shownReasons); // C2 live B6: the card and the failed line read person words
  else outcome.reasons = shownReasons(outcome.reasons);
  const done = { calls, messages, since: outcome.ok ? since : null, scrapped: outcome.ok && scrapped };
  if (!outcome.ok || outcome.reply.action !== 'recipe' || checkCtx.shapeOnly.includes('recipe')) return { ...outcome, ...done };
  const model = deps.lyricsModel?.(outcome.reply.recipe.language);
  const step = await recipeLyrics(outcome.reply.recipe, { request: ctx.request, draft: ctx.draft }, {
    ask: (msgs, lyricsSchema) => { done.calls += 1; return deps.ask(msgs, lyricsSchema, { maxTokens: MAX_TOKENS.lyrics, model }); },
    detect: detectLanguage,
    onAttempt: (n, reason) => deps.onLyrics?.(model, n, reason),
  });
  if (!step.ok) return { ok: false, reasons: step.reasons, attempts: step.attempts, promptTokens: outcome.promptTokens, ...done, since: null };
  const lyrics = { mode: step.mode, attempts: step.attempts, ...(step.mode === 'write' && model ? { model } : {}) };
  return { ...outcome, reply: { ...outcome.reply, recipe: step.recipe }, ...done, lyrics };
}
