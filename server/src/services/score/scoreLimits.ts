/**
 * The review's hard limits (F-022): a plan that cannot render whole is refused with the number
 * and the answer. YuE2 renders at most 360 s and plans within a 4,096-token budget (counted with
 * chords kept, yue-server's apply reply); a plan that changes nothing must never render. Pure.
 * planJob runs every applied plan through `withLimits`, so a limit is fed back to the planner
 * like any other check and, after the last attempt, ends in `check failed` with these lines.
 */
import type { ApplyResult } from './planTypes.js';

export const LIMIT_SECONDS = 360;
/** From here the review warns (the client turns the checks segment rust). */
export const WARN_SECONDS = 330;
export const TOKEN_LIMIT = 4096;
export const NO_CHANGE = 'this request did not change the score or the style';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** The slowest whole BPM that brings `seconds` (at `bpm`) under the limit. */
export function minBpmThatFits(seconds: number, bpm: number): number {
  const exact = (seconds * bpm) / LIMIT_SECONDS;
  return Number.isInteger(exact) ? exact + 1 : Math.ceil(exact);
}

export interface LimitFacts {
  seconds: number | null;
  bpm: number | null;
  tokens: number | null;
  changed: { abc: boolean; style: boolean };
}

/** One line per limit broken; empty when the plan can render whole. */
export function limitReasons(f: LimitFacts): string[] {
  const out: string[] = [];
  if (!f.changed.abc && !f.changed.style) out.push(NO_CHANGE);
  if (f.seconds !== null && f.seconds >= LIMIT_SECONDS) {
    const fits = f.bpm ? `; at least ${minBpmThatFits(f.seconds, f.bpm)} BPM fits` : '';
    out.push(`estimated ${fmt(f.seconds)} s: over the ${LIMIT_SECONDS} s limit${fits}`);
  }
  if (f.tokens !== null && f.tokens > TOKEN_LIMIT) out.push(`${fmt(f.tokens - TOKEN_LIMIT)} tokens over the ${fmt(TOKEN_LIMIT)} limit`);
  return out;
}

/** An applied plan with the limits folded into its checks: over a limit = not ok. A refused op
 * already says why nothing changed, so "did not change" is only added when every op applied. */
export function withLimits(result: ApplyResult): ApplyResult {
  const refused = result.verdicts.some((v) => !v.ok);
  const broken = limitReasons(result).filter((r) => r !== NO_CHANGE || !refused);
  if (broken.length === 0) return result;
  return { ...result, ok: false, checks: { ...result.checks, ok: false, problems: [...result.checks.problems, ...broken] } };
}

/** APPLY & RENDER's refusals (F-023 #3, F-024 #4): each names why nothing was started. */
export const PLAN_EXPIRED = 'plan expired: the server restarted or a newer plan replaced it';
export const NO_SEED = 'the base version has no stored seed or lyrics to render with';
export const editQueued = (what: string) => `a ${what} was queued after this plan`;
export const plannerLoaded = (models: string[]) =>
  `the planner still holds the GPU (${models.join(', ')}): wait for it to unload, or run \`ollama stop ${models[0]}\``;
export const plannerUnconfirmed = (why: string) => `can't confirm the planner let go of the GPU: ${why}`;
