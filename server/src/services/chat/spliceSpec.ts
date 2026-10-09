/**
 * The chat APPLY job's pure builders (C4, F-069, D-263, D-266), out of spliceRenderJob.ts so it stays under the cap:
 * the yue-server splice spec (v1: one `op`; v2: `steps`, in the card's order, last bar first), whether the plan needs
 * the one YuE2 render first (a REHARMONIZE anywhere in it), the version record (`splice_v` 1 for one span, 2 for a
 * chain) and the fallback's words when yue-server answers `rerender`. A step that merged several REHARMONIZE ops
 * (spliceSteps) is sent as one synthetic REHARMONIZE over the step's bars with every merged op's chords; yue-server reads
 * its bars only, the chords are the render's.
 */
import type { Op, Plan } from '../score/planTypes.js';
import type { SpliceRecord, SpliceRow } from '../score/scoreVersion.js';
import type { Grid } from './gridCache.js';
import type { Splice, SpliceKind, SpliceStep } from './spliceEligibility.js';
import { fallbackReason } from './versionCard.js';
import { isChain, type SpliceResult, type SpliceSpec, type SpliceStepResult } from './yueSpliceClient.js';

type Spliced = Extract<Splice, { splice: true }>;

/** The op yue-server gets for one step. */
export function stepOp(step: SpliceStep, ops: Op[]): Op {
  if (step.ops.length === 1) return ops[step.ops[0]];
  const chords = step.ops.flatMap((i) => { const op = ops[i]; return op.op === 'REHARMONIZE' ? op.chords : []; });
  return { op: 'REHARMONIZE', from_bar: step.from_bar, to_bar: step.to_bar, chords };
}

/** The splice needs the edited score rendered first: a REHARMONIZE, or a chain with one (D-263: one render at most). */
export function needsRender(s: Splice): boolean {
  if (!s.splice) return false;
  return s.kind === 'several' ? s.steps.some((st) => st.kind === 'reharmonize') : s.kind === 'reharmonize';
}

export function spliceSpec(s: Spliced, plan: Pick<Plan, 'ops' | 'abc'>, baseAbc: string, renderJob: string | null, grid: Grid | null): SpliceSpec {
  const what = s.kind === 'several' ? { steps: s.steps.map((st) => ({ op: stepOp(st, plan.ops) })) } : { op: plan.ops[0] };
  return { ...what, base_abc: baseAbc, ...(renderJob ? { render_job: renderJob } : {}), edited_abc: plan.abc, ...(grid ? { base_grid: grid } : {}) };
}

const KINDS: readonly string[] = ['reharmonize', 'cut', 'repeat'];
const kindOf = (r: SpliceStepResult, fallback: SpliceKind): SpliceKind => {
  const k = String(r.kind).toLowerCase();
  return KINDS.includes(k) ? (k as SpliceKind) : fallback;
};

const row = (r: SpliceStepResult, kind: SpliceKind): SpliceRow => ({
  kind, bars: r.bars, joins_s: r.joins_s, crossfade_s: r.crossfade_s, gain_db: r.gain_db,
  snap_ms: r.snap.map((x) => x.delta_ms), length_diff_s: r.length_diff_s, null_test: r.null_test,
});

/** The version's `params_json.splice` for an `ok` result. */
export function spliceRecord(r: SpliceResult, s: Spliced): SpliceRecord {
  if (!isChain(r)) return { splice_v: 1, ...row(r, s.kind === 'several' ? kindOf(r, 'reharmonize') : s.kind) };
  const steps = s.kind === 'several' ? s.steps : [];
  return {
    splice_v: 2, kind: 'several', bars: r.bars, joins_s: r.joins_s, length_diff_s: r.length_diff_s, null_test: r.null_test,
    steps: r.steps.map((x, i) => row(x, kindOf(x, steps[i]?.kind ?? 'reharmonize'))),
  };
}

/** Why the whole song was saved instead: D-101's words; a chain adds the step that said no and its bars. */
export function spliceFallback(r: SpliceResult): string {
  const why = fallbackReason(r);
  if (!isChain(r) || !r.step) return why;
  const bars = r.steps[r.step - 1]?.bars;
  return `${why} (step ${r.step}${bars ? `, bars ${bars[0]}–${bars[1]}` : ''})`;
}
