/**
 * The chain planner (C4, F-069, D-263, D-265): a plan's ops → the ordered splice steps APPLY runs on yue-server, or
 * why the whole song renders instead. Every op must be a REHARMONIZE, CUT or REPEAT with a span (a section op's span is
 * its section as read). REHARMONIZE spans merge when they overlap or their gap is under 2 bars or under 3.0 s (SP-4's
 * level window; a 4/4 bar is 4 × 60 / bpm s): the gap bars are re-sung from the render. A CUT or REPEAT within that gap
 * of any other op's span is not chained (unequal-length merges are new DSP, Q-149). 2-4 steps after merging (Q-152).
 * Steps run last bar first, so every step's bars stay numbered as read (D-066); each lists the plan op indexes it covers.
 * Pure; the per-op song checks (meter, chords, inside the song, last-section REPEAT) are spliceEligibility's.
 */
import type { Op, ScoreFacts } from '../score/planTypes.js';

export type SpliceKind = 'reharmonize' | 'cut' | 'repeat';
/** One splice of the chain, in bars as read; `ops` are the plan's op indexes it covers (ascending). */
export interface SpliceStep { kind: SpliceKind; from_bar: number; to_bar: number; ops: number[] }
export type SpliceSteps = { steps: SpliceStep[]; needsRender: boolean } | { reason: string };
export interface StepFacts { header: Pick<ScoreFacts['header'], 'bpm' | 'bars'>; sections: ScoreFacts['sections'] }

export const MIN_STEPS = 2;
export const MAX_STEPS = 4;
const GAP_BARS = 2;
const GAP_SECONDS = 3.0;
const words = (op: string) => op.replace('_', ' ');

/** The op's span as read, or why it has none. */
export function opSpan(op: Op, sections: StepFacts['sections']): { kind: SpliceKind; from: number; to: number } | string {
  if (op.op === 'REHARMONIZE') return { kind: 'reharmonize', from: op.from_bar, to: op.to_bar };
  if (op.op === 'CUT' || op.op === 'REPEAT') {
    const s = sections.find((x) => x.index === op.section);
    return s ? { kind: op.op === 'CUT' ? 'cut' : 'repeat', from: s.from_bar, to: s.to_bar } : `section S${op.section} is not in the song as read`;
  }
  return `${words(op.op)} changes the whole take, so it cannot be spliced into the old one`;
}

type Span = { kind: SpliceKind; from: number; to: number; ops: number[] };
const bars = (s: { from: number; to: number }) => `bars ${s.from}-${s.to}`;

export function spliceSteps(ops: Op[], { header, sections }: StepFacts): SpliceSteps {
  const spans: Span[] = [];
  for (const [i, op] of ops.entries()) {
    const s = opSpan(op, sections);
    if (typeof s === 'string') return { reason: s };
    spans.push({ ...s, ops: [i] });
  }
  const barSeconds = (4 * 60) / header.bpm;
  /** Bars strictly between two spans (0 = touching, negative = overlapping). */
  const gap = (a: Span, b: Span) => Math.max(a.from, b.from) - Math.min(a.to, b.to) - 1;
  const close = (a: Span, b: Span) => gap(a, b) < GAP_BARS || gap(a, b) * barSeconds < GAP_SECONDS;

  for (const s of spans) {
    if (s.kind === 'reharmonize') continue;
    const other = spans.find((o) => o !== s && close(s, o));
    if (!other) continue;
    const op = ops[s.ops[0]] as Extract<Op, { op: 'CUT' | 'REPEAT' }>;
    const how = gap(s, other) < 0 ? 'overlaps' : `is under ${GAP_BARS} bars or ${GAP_SECONDS} s from`;
    return { reason: `the ${s.kind} of the ${op.label} (${bars(s)}) ${how} ${bars(other)}, so the two cannot be spliced one after the other` };
  }

  const merged: Span[] = [];
  for (const s of [...spans].sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last && last.kind === 'reharmonize' && s.kind === 'reharmonize' && close(last, s)) {
      last.to = Math.max(last.to, s.to);
      last.ops = [...last.ops, ...s.ops].sort((a, b) => a - b);
    } else merged.push({ ...s, ops: [...s.ops] });
  }
  if (merged.length > MAX_STEPS) return { reason: `the plan changes ${merged.length} separate spans; at most ${MAX_STEPS} can be spliced into the old take` };
  if (merged.length < MIN_STEPS) {
    return { reason: `the changes merge into one span, ${bars(merged[0] ?? { from: 0, to: 0 })}; a chained splice needs ${MIN_STEPS} to ${MAX_STEPS} separate spans` };
  }
  const steps = merged.reverse().map((s) => ({ kind: s.kind, from_bar: s.from, to_bar: s.to, ops: s.ops }));
  return { steps, needsRender: steps.some((s) => s.kind === 'reharmonize') };
}
