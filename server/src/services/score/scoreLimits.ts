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

/** An applied plan with the limits folded into its checks: over a limit = not ok. */
export function withLimits(result: ApplyResult): ApplyResult {
  const broken = limitReasons(result);
  if (broken.length === 0) return result;
  return { ...result, ok: false, checks: { ...result.checks, ok: false, problems: [...result.checks.problems, ...broken] } };
}
