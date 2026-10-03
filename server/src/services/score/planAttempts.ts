/** The planner's retry loop (F-019 #3, SP-2): ask, check the reply against the song's bounds,
 * apply it through yue-server, and on any rejection send the reply back with one reason per op;
 * at most MAX_ATTEMPTS asks. A thrown error (HTTP, timeout, context refusal) ends it at once.
 * I/O is injected, so this is pure logic. */
import { checkOps } from './opSchema.js';
import { retryMessages } from './plannerPrompt.js';
import type { ApplyResult, ChatMessage, Op, PlannerReply, ScoreFacts } from './planTypes.js';

export const MAX_ATTEMPTS = 3;
/** Reasons sent back per attempt; more only buries the first ones. */
const MAX_REASONS = 8;

export interface AttemptDeps {
  ask: (messages: ChatMessage[]) => Promise<PlannerReply>;
  apply: (ops: Op[]) => Promise<ApplyResult>;
  /** Attempt n starts; `reason` is the first thing wrong with the previous one. */
  onAttempt?: (n: number, reason?: string) => void;
}

export type AttemptsOutcome =
  | { ok: true; ops: Op[]; applied: ApplyResult; attempts: number }
  | { ok: false; reasons: string[]; attempts: number };

/** Why yue-server refused an applied plan: failed ops by index, then the edit's checks. */
export function applyReasons(result: ApplyResult): string[] {
  const ops = result.verdicts.filter((v) => !v.ok).map((v) => `op ${v.index} (${v.op}): ${v.reason ?? 'did not apply'}`);
  const checks = [...result.checks.problems, ...result.checks.differences];
  const out = [...ops, ...checks];
  return out.length ? out : ['the edited score did not pass the check'];
}

function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

export async function planAttempts(
  facts: ScoreFacts, messages: ChatMessage[], deps: AttemptDeps, maxAttempts = MAX_ATTEMPTS,
): Promise<AttemptsOutcome> {
  let msgs = messages;
  let reasons: string[] = [];
  for (let n = 1; n <= maxAttempts; n++) {
    deps.onAttempt?.(n, reasons[0]);
    const reply = await deps.ask(msgs);
    const json = parse(reply.content);
    const shape = json === undefined ? { ok: false as const, reasons: ['the reply is not valid JSON'] } : checkOps(json, facts);
    if (shape.ok) {
      const result = await deps.apply(shape.ops);
      if (result.ok) return { ok: true, ops: shape.ops, applied: result, attempts: n };
      reasons = applyReasons(result);
    } else {
      reasons = shape.reasons;
    }
    reasons = reasons.slice(0, MAX_REASONS);
    msgs = retryMessages(msgs, reply.content, reasons);
  }
  return { ok: false, reasons, attempts: maxAttempts };
}
