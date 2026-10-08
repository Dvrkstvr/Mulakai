/**
 * THE LADDER SEAM (architecture.md "Chat (C0)", docs/decisions/0006): how many model calls a turn
 * makes lives here and nowhere else. `decideReply` returns a checked reply (or the reasons) whatever
 * the number of calls. Rung 0 (default, SP-5's base): one call with the full schema. Rung 2: the
 * same call offering only what the state allows (turnActions). Rungs 1 (router + per-action call)
 * and 3 (lyrics as their own call) are not built: SP-5's base run met its bars so far, and a rung
 * that is not built runs as rung 0. `CHAT_LADDER` picks the rung. SP-5's call settings: max_tokens
 * 4000 when the reply may be an edit (2000 cut a 40-bar REHARMONIZE three times; a recipe needs
 * under 800), temperature 0.3, reasoning off and the strict schema (plannerClient). Pure (I/O injected).
 */
import type { ApplyResult, ChatMessage as PromptMessage, Op, PlannerReply, ScoreFacts } from '../score/planTypes.js';
import { turnSchema } from './actionSchema.js';
import { chatRules } from './chatRules.js';
import { checkReply } from './replyCheck.js';
import { asksWholeSong } from './markFit.js';
import { detectLanguage } from './lyricLanguage.js';
import { draftLines } from './songState.js';
import { allowedActions, redirected, type TurnState } from './turnActions.js';
import { turnAttempts, type TurnOutcome } from './turnAttempts.js';
import { turnMessages } from './turnPrompt.js';
import { phraseBarsOf } from '../score/phraseRequest.js';
import type { ChatMessage, DraftFields } from './chatTypes.js';

export const BUILT_RUNGS = [0, 2];
/** Completion tokens per call (SP-5): an edit-capable call needs room for 6 ops of chords. */
export const MAX_TOKENS = { edit: 4000, other: 2000 };

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
}

export interface CallDeps {
  ask: (messages: PromptMessage[], schema: Record<string, unknown>, opts: { maxTokens: number }) => Promise<PlannerReply>;
  /** yue-server's apply for an edit (CB-2); absent = ops are checked by shape and bounds only. */
  apply?: (ops: Op[]) => Promise<ApplyResult>;
  onAttempt?: (n: number, reason?: string) => void;
  rung?: number;
}

export type Decision = TurnOutcome & { calls: number; messages: PromptMessage[] };

export async function decideReply(ctx: TurnContext, deps: CallDeps): Promise<Decision> {
  const allowed = allowedActions(ctx.state, deps.rung ?? 0);
  const phraseBars = phraseBarsOf(ctx.request);
  const reference = Boolean(ctx.state.referenceRead); // C3: reference_use and its rule only with a reading (D-128)
  const markRange = ctx.mark?.range ?? null;
  const markWhole = markRange ? asksWholeSong(ctx.request) : false; // C1 live B2: a mark bounds whole-song ops too
  const schema = turnSchema({ facts: ctx.facts, phraseBars, allowed, reference, barRange: markRange, wholeSong: markWhole });
  const pending = draftLines(ctx.draft, ctx.pending);
  const messages = turnMessages({ rules: chatRules(allowed, { reference }), state: ctx.block, facts: ctx.facts, request: ctx.request, pending, history: ctx.history, mark: ctx.mark?.lines });
  const checkCtx = { allowed, shapeOnly: redirected(ctx.state), facts: ctx.facts, phraseBars, request: ctx.request, markRange, markWhole };
  const maxTokens = allowed.includes('edit') ? MAX_TOKENS.edit : MAX_TOKENS.other;
  let calls = 0;
  const outcome = await turnAttempts(messages, {
    ask: (msgs) => { calls += 1; return deps.ask(msgs, schema, { maxTokens }); },
    check: (json) => checkReply(json, checkCtx, { apply: deps.apply, language: detectLanguage }),
    onAttempt: deps.onAttempt,
  });
  return { ...outcome, calls, messages };
}
