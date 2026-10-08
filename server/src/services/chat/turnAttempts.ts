/**
 * A turn's retry loop (SP-5's, the planner's shape): ask, parse, check the reply (replyCheck, injected),
 * and on a rejection send the reply back, shortened, with its reasons (turnRetry, built on the first
 * attempt's messages so attempt 3 stays near attempt 1's size, C1 re-check N4); at most MAX_ATTEMPTS asks. A
 * thrown error (HTTP, timeout, context refusal, cancel) ends it at once. Progress "attempt n of 3 ·
 * reason" goes through onAttempt. Pure (I/O injected).
 */
import { MAX_ATTEMPTS } from '../score/planAttempts.js';
import type { ApplyResult, ChatMessage as PromptMessage, PlannerReply } from '../score/planTypes.js';
import { turnRetry } from './turnPrompt.js';
import type { Checked } from './replyCheck.js';
import type { TurnReply } from './chatTypes.js';

export { MAX_ATTEMPTS };
/** Reasons sent back per attempt; more only buries the first ones. */
const MAX_REASONS = 8;

export interface TurnAttemptDeps {
  ask: (messages: PromptMessage[]) => Promise<PlannerReply>;
  check: (json: unknown) => Promise<Checked>;
  /** Attempt n starts; `reason` is the first thing wrong with the previous one. */
  onAttempt?: (n: number, reason?: string) => void;
}

export type TurnOutcome =
  /** `refusals`: each earlier refused attempt's reasons, so an edit card says what a retry moved (D-060). */
  | { ok: true; reply: TurnReply; applied: ApplyResult | null; attempts: number; promptTokens: Array<number | null>; refusals: string[][] }
  | { ok: false; reasons: string[]; attempts: number; promptTokens: Array<number | null> };

function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

export async function turnAttempts(messages: PromptMessage[], deps: TurnAttemptDeps, maxAttempts = MAX_ATTEMPTS): Promise<TurnOutcome> {
  let msgs = messages;
  const refused: Array<{ reply: string; reasons: string[] }> = [];
  let reasons: string[] = [];
  const promptTokens: Array<number | null> = [];
  const refusals: string[][] = [];
  for (let n = 1; n <= maxAttempts; n++) {
    deps.onAttempt?.(n, reasons[0]);
    const answer = await deps.ask(msgs);
    promptTokens.push(answer.promptTokens);
    const json = parse(answer.content);
    const checked: Checked = json === undefined ? { ok: false, reasons: ['the reply is not valid JSON'] } : await deps.check(json);
    if (checked.ok) return { ok: true, reply: checked.reply, applied: checked.applied, attempts: n, promptTokens, refusals };
    reasons = checked.reasons.slice(0, MAX_REASONS);
    refusals.push(reasons);
    refused.push({ reply: answer.content, reasons });
    msgs = turnRetry(messages, refused);
  }
  return { ok: false, reasons, attempts: maxAttempts, promptTokens };
}
