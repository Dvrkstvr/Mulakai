/**
 * The review's hard limits (F-022): a plan that cannot render whole is refused with the number
 * and the answer. YuE2 renders at most 360 s and plans within a 4,096-token budget (counted with
 * chords kept, yue-server's apply reply); a plan that changes nothing must never render. Pure.
 * planJob runs every applied plan through `withLimits`, so a limit is fed back to the planner
 * like any other check and, after the last attempt, ends in `check failed` with these lines. A plan
 * with a REPEAT that passes 360 s also names the smallest section whose cut fits (F-030 #2), by the
 * read's section number, so a CUT built from the line addresses the right section (D-066 b).
 */
import type { ApplyResult, Op, ScoreFacts, ScoreSection } from './planTypes.js';

export const LIMIT_SECONDS = 360;
/** From here the review warns (the client turns the checks segment rust). */
export const WARN_SECONDS = 330;
export const TOKEN_LIMIT = 4096;
export const NO_CHANGE = 'this request did not change the score, the style or the lyrics';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** The slowest whole BPM that brings `seconds` (at `bpm`) under the limit. */
export function minBpmThatFits(seconds: number, bpm: number): number {
  const exact = (seconds * bpm) / LIMIT_SECONDS;
  return Number.isInteger(exact) ? exact + 1 : Math.ceil(exact);
}

/** A section to cut so a plan fits: `section` is the read's number (the bar map's S<n>). */
export interface CutHint { section: number; label: string; seconds: number }

export interface LimitFacts {
  seconds: number | null;
  bpm: number | null;
  tokens: number | null;
  changed: { abc: boolean; style: boolean; lyrics?: boolean };
  cut?: CutHint | null;
}

const clock = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

/** One line per limit broken; empty when the plan can render whole. */
export function limitReasons(f: LimitFacts): string[] {
  const out: string[] = [];
  if (!f.changed.abc && !f.changed.style && !f.changed.lyrics) out.push(NO_CHANGE);
  if (f.seconds !== null && f.seconds >= LIMIT_SECONDS) {
    const cut = f.cut ? `cut the ${f.cut.label} ${clock(f.cut.seconds)} to fit (section ${f.cut.section})` : '';
    const bpm = f.bpm ? `at least ${minBpmThatFits(f.seconds, f.bpm)} BPM fits` : '';
    const fits = [cut, bpm].filter(Boolean).join(', or ');
    out.push(`estimated ${fmt(f.seconds)} s: over the ${LIMIT_SECONDS} s limit${fits ? `; ${fits}` : ''}`);
  }
  if (f.tokens !== null && f.tokens > TOKEN_LIMIT) out.push(`${fmt(f.tokens - TOKEN_LIMIT)} tokens over the ${fmt(TOKEN_LIMIT)} limit`);
  return out;
}

/** Each edited section's read number (D-066 b: ops address the score as read): the read's sections
 * minus the applied CUTs, each applied REPEAT's copy right after its section. Null when that does not
 * explain the reply's sections (then no hint is better than a wrong one). */
export function readNumbers(read: ScoreSection[], ops: Op[], result: ApplyResult): Array<{ read: number; copy: boolean }> | null {
  const applied = ops.filter((_, i) => result.verdicts[i]?.ok);
  const count = (kind: string, n: number) => applied.filter((o) => o.op === kind && 'section' in o && o.section === n).length;
  const out = read.flatMap((s) => (count('CUT', s.index) ? [] : [
    { read: s.index, copy: false }, ...Array.from({ length: count('REPEAT', s.index) }, () => ({ read: s.index, copy: true })),
  ]));
  const edited = result.sections ?? [];
  const same = out.length === edited.length && out.every((m, i) => read.find((s) => s.index === m.read)?.label === edited[i].label);
  return same ? out : null;
}

/** The smallest section whose cut brings a plan with an applied REPEAT under the limit; never the
 * repeated section or its copies. */
export function cutHint(read: ScoreSection[], ops: Op[], result: ApplyResult): CutHint | null {
  const repeated = ops.filter((o, i) => o.op === 'REPEAT' && result.verdicts[i]?.ok).map((o) => ('section' in o ? o.section : 0));
  const numbers = repeated.length && result.seconds !== null ? readNumbers(read, ops, result) : null;
  if (!numbers) return null;
  const fits = (result.sections ?? [])
    .map((s, i) => ({ section: numbers[i].read, label: s.label, seconds: s.seconds }))
    .filter((c) => c.label && !repeated.includes(c.section) && result.seconds! - c.seconds < LIMIT_SECONDS)
    .sort((a, b) => a.seconds - b.seconds);
  return fits[0] ?? null;
}

/** An applied plan with the limits folded into its checks: over a limit = not ok. A refused op
 * already says why nothing changed, so "did not change" is only added when every op applied.
 * `plan` (the ops and the read's sections) lets a plan with a REPEAT name the section to cut. */
export function withLimits(result: ApplyResult, plan?: { ops: Op[]; sections: ScoreSection[] }): ApplyResult {
  const refused = result.verdicts.some((v) => !v.ok);
  const cut = plan ? cutHint(plan.sections, plan.ops, result) : null;
  const broken = limitReasons({ ...result, cut }).filter((r) => r !== NO_CHANGE || !refused);
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

/** The edited score's bar count for the review's checks line: its sections cover every bar in order (yue-server
 * section_ranges), so the last one ends on the last bar; the read's count when the edited score did not parse. */
export const editedBars = (result: Pick<ApplyResult, 'sections'>, facts: Pick<ScoreFacts, 'header'>): number =>
  result.sections?.at(-1)?.to_bar ?? facts.header.bars;
