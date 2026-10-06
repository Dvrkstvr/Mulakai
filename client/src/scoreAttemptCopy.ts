/** SCORE's review checks: the one checks line, and a line per earlier refused attempt (D-060;
 * Q-036, Q-040), so a plan that moved a phrase or raised a tempo to pass is never silent. Pure.
 * Part of the SCORE copy (dock rule), split from scoreCopy.ts by responsibility; it re-exports these. */
import type { ScorePlan } from './api';

export const MAX_ATTEMPTS = 3;
const LIMIT_SECONDS = 360;
const WARN_SECONDS = 330;
const TOKEN_LIMIT = 4096;
const n = (v: number) => Math.round(v).toLocaleString('en-US');

export interface Segment { text: string; warn: boolean }

/** The one checks line; a segment past its limit (330 s and up, over 4,096 tokens) turns rust. A
 * chord-free score rendered as a melody (F-065, D-132) has no chords by design: "no chords", plain. */
export function checksSegments(c: ScorePlan['checks'], attempts: number, mode?: ScorePlan['renderMode']): Segment[] {
  const out: Segment[] = [{ text: `${c.bars} bars`, warn: false }];
  if (c.seconds !== null) out.push({ text: `est ${n(c.seconds)} s of ${LIMIT_SECONDS} s`, warn: c.seconds > WARN_SECONDS });
  if (c.tokens !== null) out.push({ text: `${n(c.tokens)} of ${n(TOKEN_LIMIT)} tokens`, warn: c.tokens > TOKEN_LIMIT });
  if (c.chordsPresent === false && mode?.cot === 'melody') out.push({ text: 'no chords · melody render', warn: false });
  else if (c.chordsPresent !== null) out.push({ text: c.chordsPresent ? 'chords valid' : 'chords invalid', warn: !c.chordsPresent });
  out.push({ text: `attempt ${attempts} of ${MAX_ATTEMPTS}`, warn: false });
  return out;
}

/** Reasons shown per attempt; the rest are counted, so one line stays one line. */
const SHOWN = 2;
/** "op 1 (WRITE_PHRASE): " addresses the op for the planner; the review has the op's row. */
const plain = (reason: string) => reason.replace(/^op \d+ \([A-Z_]+\): /, '');

/** "attempt 1 refused: the Vocal sings in bars 20-23; free: 1-10, 47-65"; none when attempt 1 passed. */
export function refusedLines(plan: Pick<ScorePlan, 'refusals'>): string[] {
  return plan.refusals.map((reasons, i) => {
    const words = [...new Set(reasons.map(plain))];
    const shown = words.length ? words.slice(0, SHOWN).join(' · ') : 'it did not pass the check';
    const more = words.length > SHOWN ? ` · and ${words.length - SHOWN} more` : '';
    return `attempt ${i + 1} refused: ${shown}${more}`;
  });
}
