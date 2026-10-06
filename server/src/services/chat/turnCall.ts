/**
 * THE LADDER SEAM (architecture.md "Chat (C0)", docs/decisions/0006): how many model calls a turn
 * makes lives here and nowhere else. `decideReply` returns a checked reply (or the reasons) whatever
 * the number of calls. Rung 0 (default, SP-5's base): one call with the full schema. Rung 2: the
 * same call offering only what the state allows (turnActions). Rungs 1 (router + per-action call)
 * and 3 (lyrics as their own call) are not built: SP-5's base run met its bars so far, and a rung
 * that is not built runs as rung 0. `CHAT_LADDER` picks the rung. Pure (I/O injected).
 */
import type { ApplyResult, ChatMessage as PromptMessage, Op, PlannerReply, ScoreFacts } from '../score/planTypes.js';
import { turnSchema } from './actionSchema.js';
import { chatRules } from './chatRules.js';
import { checkReply } from './replyCheck.js';
import { allowedActions, redirected, type TurnState } from './turnActions.js';
import { turnAttempts, type TurnOutcome } from './turnAttempts.js';
import { turnMessages } from './turnPrompt.js';
import { phraseBarsOf } from '../score/phraseRequest.js';
import type { ChatMessage } from './chatTypes.js';

export const BUILT_RUNGS = [0, 2];

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
  pending: boolean;
  history: ChatMessage[];
}

export interface CallDeps {
  ask: (messages: PromptMessage[], schema: Record<string, unknown>) => Promise<PlannerReply>;
  /** yue-server's apply for an edit (CB-2); absent = ops are checked by shape and bounds only. */
  apply?: (ops: Op[]) => Promise<ApplyResult>;
  onAttempt?: (n: number, reason?: string) => void;
  rung?: number;
}

export type Decision = TurnOutcome & { calls: number; messages: PromptMessage[] };

export async function decideReply(ctx: TurnContext, deps: CallDeps): Promise<Decision> {
  const allowed = allowedActions(ctx.state, deps.rung ?? 0);
  const phraseBars = phraseBarsOf(ctx.request);
  const schema = turnSchema({ facts: ctx.facts, phraseBars, allowed });
  const messages = turnMessages({ rules: chatRules(allowed), state: ctx.block, facts: ctx.facts, request: ctx.request, pending: ctx.pending, history: ctx.history });
  const checkCtx = { allowed, shapeOnly: redirected(ctx.state), facts: ctx.facts, phraseBars };
  let calls = 0;
  const outcome = await turnAttempts(messages, {
    ask: (msgs) => { calls += 1; return deps.ask(msgs, schema); },
    check: (json) => checkReply(json, checkCtx, { apply: deps.apply }),
    onAttempt: deps.onAttempt,
  });
  return { ...outcome, calls, messages };
}
