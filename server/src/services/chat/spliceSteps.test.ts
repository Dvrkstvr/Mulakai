/** The chain planner (C4, F-069, D-263/D-265): which ops chain, the merge, the 2-4 step limit, the order. */
import { describe, it, expect } from 'vitest';
import { spliceSteps, type SpliceStep, type StepFacts } from './spliceSteps.js';
import type { Op } from '../score/planTypes.js';

// 64 bars of 4/4: intro 1-8, verse 9-24, chorus 25-32, verse 33-48, chorus 49-56, outro 57-64
const song = (bpm = 120): StepFacts => ({
  header: { bpm, bars: 64 },
  sections: [
    { index: 1, label: 'intro', from_bar: 1, to_bar: 8 }, { index: 2, label: 'verse', from_bar: 9, to_bar: 24 },
    { index: 3, label: 'chorus', from_bar: 25, to_bar: 32 }, { index: 4, label: 'verse', from_bar: 33, to_bar: 48 },
    { index: 5, label: 'chorus', from_bar: 49, to_bar: 56 }, { index: 6, label: 'outro', from_bar: 57, to_bar: 64 },
  ],
});
const reharm = (from_bar: number, to_bar: number): Op =>
  ({ op: 'REHARMONIZE', from_bar, to_bar, chords: [{ bar: from_bar, beat: 1, root: 'G', quality: 'm7' }] });
const cut = (section: number, label: string): Op => ({ op: 'CUT', section, label });
const repeat = (section: number, label: string): Op => ({ op: 'REPEAT', section, label });
const step = (kind: SpliceStep['kind'], from_bar: number, to_bar: number, ops: number[]): SpliceStep => ({ kind, from_bar, to_bar, ops });

/** Every plan op index is covered by exactly one step, and the steps run last bar first. */
function wellFormed(steps: SpliceStep[], ops: Op[]) {
  expect(steps.flatMap((s) => s.ops).sort((a, b) => a - b)).toEqual(ops.map((_, i) => i));
  for (let i = 1; i < steps.length; i++) expect(steps[i].to_bar).toBeLessThan(steps[i - 1].from_bar);
}

describe('spliceSteps (pure)', () => {
  it('two separate REHARMONIZE spans: two steps, last bar first, one render', () => {
    const ops = [reharm(9, 12), reharm(49, 52)];
    const out = spliceSteps(ops, song());
    expect(out).toEqual({ steps: [step('reharmonize', 49, 52, [1]), step('reharmonize', 9, 12, [0])], needsRender: true });
    if ('steps' in out) wellFormed(out.steps, ops);
  });

  it('three and four steps of mixed kinds, sorted descending; CUT/REPEAT-only needs no render', () => {
    const three = [cut(1, 'intro'), reharm(33, 36), repeat(5, 'chorus')];
    expect(spliceSteps(three, song())).toEqual({
      steps: [step('repeat', 49, 56, [2]), step('reharmonize', 33, 36, [1]), step('cut', 1, 8, [0])], needsRender: true,
    });
    const four = [reharm(11, 12), cut(3, 'chorus'), reharm(40, 44), cut(6, 'outro')];
    const out = spliceSteps(four, song());
    expect(out).toEqual({
      steps: [step('cut', 57, 64, [3]), step('reharmonize', 40, 44, [2]), step('cut', 25, 32, [1]), step('reharmonize', 11, 12, [0])],
      needsRender: true,
    });
    if ('steps' in out) wellFormed(out.steps, four);
    expect(spliceSteps([cut(1, 'intro'), repeat(3, 'chorus')], song())).toMatchObject({ needsRender: false });
  });

  it('more than 4 spans after merging renders the whole song, with the reason (D-265, Q-152)', () => {
    const five = [reharm(1, 2), reharm(10, 12), reharm(20, 22), reharm(30, 32), reharm(40, 42)];
    expect(spliceSteps(five, song())).toEqual({ reason: 'the plan changes 5 separate spans; at most 4 can be spliced into the old take' });
  });

  it('5-6 ops that merge down to 4 spans still chain', () => {
    const six = [reharm(1, 2), reharm(3, 4), reharm(20, 22), reharm(30, 32), reharm(40, 42), reharm(50, 52)];
    // 6 ops, 5 spans (1-4 merged): too many
    expect(spliceSteps(six, song())).toEqual({ reason: 'the plan changes 5 separate spans; at most 4 can be spliced into the old take' });
    const fiveToFour = [reharm(1, 2), reharm(3, 4), reharm(20, 22), reharm(30, 32), reharm(40, 42)];
    const ok = spliceSteps(fiveToFour, song());
    expect(ok).toEqual({
      steps: [step('reharmonize', 40, 42, [4]), step('reharmonize', 30, 32, [3]), step('reharmonize', 20, 22, [2]), step('reharmonize', 1, 4, [0, 1])],
      needsRender: true,
    });
    if ('steps' in ok) wellFormed(ok.steps, fiveToFour);
  });

  it('REHARMONIZE spans that overlap, touch or are 1 bar apart merge into one span (the gap bars are re-sung)', () => {
    const tail = reharm(57, 60); // keeps a second step so the plan still chains
    for (const [a, b, merged] of [[[9, 14], [12, 16], [9, 16]], [[9, 12], [13, 16], [9, 16]], [[9, 12], [14, 16], [9, 16]]] as const) {
      const ops = [reharm(...a), reharm(...b), tail];
      expect(spliceSteps(ops, song())).toEqual({ steps: [step('reharmonize', 57, 60, [2]), step('reharmonize', ...merged, [0, 1])], needsRender: true });
    }
    // order in the plan does not matter; one op inside another
    expect(spliceSteps([tail, reharm(10, 11), reharm(9, 16)], song()))
      .toEqual({ steps: [step('reharmonize', 57, 60, [0]), step('reharmonize', 9, 16, [1, 2])], needsRender: true });
  });

  it('a 2-bar gap: no merge at 60 or 140 BPM (bars of 4.0 s / 1.7 s), merged at 180 BPM (2 bars = 2.7 s < 3.0 s)', () => {
    const ops = [reharm(9, 12), reharm(15, 18)];
    for (const bpm of [60, 140]) {
      expect(spliceSteps(ops, song(bpm))).toEqual({ steps: [step('reharmonize', 15, 18, [1]), step('reharmonize', 9, 12, [0])], needsRender: true });
    }
    expect(spliceSteps([...ops, reharm(57, 60)], song(180)))
      .toEqual({ steps: [step('reharmonize', 57, 60, [2]), step('reharmonize', 9, 18, [0, 1])], needsRender: true });
    // 3 bars at 180 BPM is 4.0 s: separate
    expect(spliceSteps([reharm(9, 12), reharm(16, 18)], song(180))).toMatchObject({ steps: [step('reharmonize', 16, 18, [1]), {}] });
  });

  it('two changes that merge into one span render the whole song (a chain needs 2-4 separate spans)', () => {
    expect(spliceSteps([reharm(9, 12), reharm(13, 16)], song()))
      .toEqual({ reason: 'the changes merge into one span, bars 9-16; a chained splice needs 2 to 4 separate spans' });
  });

  it('a CUT or REPEAT that overlaps, touches or comes within the gap of another span is not chained (D-265, Q-149)', () => {
    expect(spliceSteps([reharm(25, 28), repeat(3, 'chorus')], song()))
      .toEqual({ reason: 'the repeat of the chorus (bars 25-32) overlaps bars 25-28, so the two cannot be spliced one after the other' });
    expect(spliceSteps([cut(3, 'chorus'), reharm(33, 36)], song()))
      .toEqual({ reason: 'the cut of the chorus (bars 25-32) is under 2 bars or 3 s from bars 33-36, so the two cannot be spliced one after the other' });
    expect(spliceSteps([cut(3, 'chorus'), reharm(34, 36)], song())).toMatchObject({ reason: expect.stringContaining('under 2 bars') });
    expect(spliceSteps([cut(2, 'verse'), cut(3, 'chorus')], song())).toMatchObject({ reason: expect.stringContaining('the cut of the verse (bars 9-24)') });
    expect(spliceSteps([cut(3, 'chorus'), cut(3, 'chorus')], song())).toMatchObject({ reason: expect.stringContaining('overlaps bars 25-32') });
    // two bars clear of the chorus chains
    expect(spliceSteps([cut(3, 'chorus'), reharm(35, 36)], song())).toMatchObject({ needsRender: true });
  });

  it('any op that is not REHARMONIZE, CUT or REPEAT renders the whole song, with the reason', () => {
    const phrase: Op = { op: 'WRITE_PHRASE', start_bar: 40, instrument: 'sax', bars: [] };
    expect(spliceSteps([reharm(9, 12), phrase], song()))
      .toEqual({ reason: 'WRITE PHRASE changes the whole take, so it cannot be spliced into the old one' });
    expect(spliceSteps([reharm(9, 12), cut(9, 'bridge')], song())).toEqual({ reason: 'section S9 is not in the song as read' });
  });
});
