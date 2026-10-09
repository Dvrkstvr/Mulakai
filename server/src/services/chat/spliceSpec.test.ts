/** The splice job's pure builders (C4, F-069, D-263, D-266): spec v1 / v2, needsRender, the version record, the fallback words. */
import { describe, it, expect } from 'vitest';
import type { Op } from '../score/planTypes.js';
import type { Splice } from './spliceEligibility.js';
import { needsRender, spliceFallback, spliceRecord, spliceSpec, stepOp } from './spliceSpec.js';
import type { SpliceResult } from './yueSpliceClient.js';

const C = (bar: number) => ({ bar, beat: 1, root: 'C' as const, quality: 'maj7' as const });
const REH_A: Op = { op: 'REHARMONIZE', from_bar: 9, to_bar: 10, chords: [C(9)] };
const REH_B: Op = { op: 'REHARMONIZE', from_bar: 11, to_bar: 12, chords: [C(11), C(12)] };
const CUT: Op = { op: 'CUT', section: 5, label: 'bridge' };
const ops = [CUT, REH_A, REH_B];
const several: Extract<Splice, { kind: 'several' }> = { splice: true, kind: 'several', from_bar: 9, to_bar: 40, steps: [
  { kind: 'cut', from_bar: 33, to_bar: 40, ops: [0] }, { kind: 'reharmonize', from_bar: 9, to_bar: 12, ops: [1, 2] }] };
const plan = { ops, abc: 'X:edited' };

const row = (over: Record<string, unknown>) => ({
  verdict: 'ok', reason: null, detail: null, kind: 'CUT', bars: [33, 40], audio_seconds: 60, length_diff_s: -16, joins_s: [64.2],
  crossfade_s: [0.5], snap: [{ delta_ms: 0, applied: true, corr: 1 }], gain_db: null, null_test: { samples: 10, different: 0 }, ...over,
});
const chain = (over: Record<string, unknown> = {}) => ({
  verdict: 'ok', reason: null, detail: null, kind: 'several', step: null, bars: [9, 40], audio_seconds: 60, length_diff_s: -16,
  joins_s: [16.2, 24.2, 64.2], null_test: { samples: 30, different: 0 },
  steps: [row({}), row({ kind: 'REHARMONIZE', bars: [9, 12], joins_s: [16.2, 24.2], crossfade_s: [0.5, 0.5], snap: [{ delta_ms: 30, applied: true, corr: 1 }, { delta_ms: -4, applied: false, corr: 0.1 }], gain_db: { in: 0, out: 0 }, length_diff_s: 0 })],
  ...over,
}) as unknown as SpliceResult;

describe('stepOp', () => {
  it('a one-op step sends its plan op as it is', () => {
    expect(stepOp(several.steps[0], ops)).toBe(CUT);
  });
  it('a merged REHARMONIZE step sends one op over the step\'s bars with every merged op\'s chords', () => {
    expect(stepOp(several.steps[1], ops)).toEqual({ op: 'REHARMONIZE', from_bar: 9, to_bar: 12, chords: [C(9), C(11), C(12)] });
  });
});

describe('needsRender', () => {
  it('a REHARMONIZE or a chain with one needs the render; CUT, REPEAT and a CUT/REPEAT chain do not', () => {
    expect(needsRender({ splice: true, kind: 'reharmonize', from_bar: 1, to_bar: 2 })).toBe(true);
    expect(needsRender({ splice: true, kind: 'cut', from_bar: 1, to_bar: 2 })).toBe(false);
    expect(needsRender(several)).toBe(true);
    expect(needsRender({ ...several, steps: [{ kind: 'repeat', from_bar: 17, to_bar: 24, ops: [1] }, { kind: 'cut', from_bar: 1, to_bar: 8, ops: [0] }] })).toBe(false);
    expect(needsRender({ splice: false, reason: 'x' })).toBe(false);
  });
});

describe('spliceSpec', () => {
  it('one span: spec v1 with its op, the render job and grid only when given', () => {
    const one: Splice = { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 10 };
    expect(spliceSpec(one, { ops: [REH_A], abc: 'X:e' }, 'X:b', 'yue-1', null)).toEqual({ op: REH_A, base_abc: 'X:b', render_job: 'yue-1', edited_abc: 'X:e' });
    expect(spliceSpec(one, { ops: [REH_A], abc: 'X:e' }, 'X:b', null, { grid_v: 1 })).toEqual({ op: REH_A, base_abc: 'X:b', edited_abc: 'X:e', base_grid: { grid_v: 1 } });
  });
  it('one span merged from several REHARMONIZE ops (D-271 b revised): spec v1 with one synthetic op over the span, every op\'s chords in plan-op order', () => {
    const merged: Splice = { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 12 };
    expect(spliceSpec(merged, { ops: [REH_A, REH_B], abc: 'X:e' }, 'X:b', 'yue-1', null)).toEqual({
      op: { op: 'REHARMONIZE', from_bar: 9, to_bar: 12, chords: [C(9), C(11), C(12)] }, base_abc: 'X:b', render_job: 'yue-1', edited_abc: 'X:e',
    });
    expect(spliceSpec(merged, { ops: [REH_B, REH_A], abc: 'X:e' }, 'X:b', null, null).op).toEqual({ op: 'REHARMONIZE', from_bar: 9, to_bar: 12, chords: [C(11), C(12), C(9)] });
  });
  it('a chain: spec v2, the steps in the card\'s order (last bar first), never an op', () => {
    const spec = spliceSpec(several, plan, 'X:b', 'yue-1', null);
    expect(spec).toEqual({ steps: [{ op: CUT }, { op: stepOp(several.steps[1], ops) }], base_abc: 'X:b', render_job: 'yue-1', edited_abc: 'X:edited' });
    expect('op' in spec).toBe(false);
  });
});

describe('spliceRecord', () => {
  it('one span: the v1 row', () => {
    const one = row({ kind: 'REHARMONIZE', bars: [9, 16] }) as unknown as SpliceResult;
    expect(spliceRecord(one, { splice: true, kind: 'reharmonize', from_bar: 9, to_bar: 16 })).toEqual({
      splice_v: 1, kind: 'reharmonize', bars: [9, 16], joins_s: [64.2], crossfade_s: [0.5], gain_db: null, snap_ms: [0], length_diff_s: -16, null_test: { samples: 10, different: 0 },
    });
  });
  it('a chain: splice_v 2 with every step\'s v1 row (step order), the final file\'s joins, total length change and null test', () => {
    expect(spliceRecord(chain(), several)).toEqual({
      splice_v: 2, kind: 'several', bars: [9, 40], joins_s: [16.2, 24.2, 64.2], length_diff_s: -16, null_test: { samples: 30, different: 0 },
      steps: [
        { kind: 'cut', bars: [33, 40], joins_s: [64.2], crossfade_s: [0.5], gain_db: null, snap_ms: [0], length_diff_s: -16, null_test: { samples: 10, different: 0 } },
        { kind: 'reharmonize', bars: [9, 12], joins_s: [16.2, 24.2], crossfade_s: [0.5, 0.5], gain_db: { in: 0, out: 0 }, snap_ms: [30, -4], length_diff_s: 0, null_test: { samples: 10, different: 0 } },
      ],
    });
  });
});

describe('spliceFallback', () => {
  it('one span: D-101\'s words; a chain names the failing step and its bars', () => {
    expect(spliceFallback({ reason: 'not_aligned', detail: 'x' } as SpliceResult)).toBe('the join could not be aligned');
    const failed = chain({ verdict: 'rerender', reason: 'level_step', detail: 'the copy\'s seam steps +10.4 dB', step: 2,
      steps: [row({}), row({ verdict: 'rerender', kind: 'REPEAT', bars: [1, 8] })] });
    expect(spliceFallback(failed)).toBe('the copy\'s seam steps +10.4 dB (step 2, bars 1–8)');
    expect(spliceFallback(chain({ verdict: 'rerender', reason: 'bar_map', detail: null, step: null, steps: [] }))).toBe('bar_map');
  });
});
