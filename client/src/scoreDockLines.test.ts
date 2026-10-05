/** What SCORE's dock body says per state with a pick and while a REVISE runs (frames 2, 4, 6, 8). */
import { describe, expect, it } from 'vitest';
import type { ScorePlan, ScoreReferent } from './api';
import { dockLines } from './scoreDockLines';
import { ASKING_CONSEQUENCE, CHECK_FAILED_CONSEQUENCE } from './scoreCopy';
import { INITIAL_SCORE, type ScorePhase, type ScoreVerbState } from './scoreVerbTypes';

const P1 = {
  id: 'p1', request: 'jazz', ops: [{ op: 'SET_TEMPO', bpm: 88 }], verdicts: [], style: '',
  checks: { bars: 65, seconds: 183, tokens: 1520, chordsPresent: true, changed: { abc: true, style: false } },
} as unknown as ScorePlan;
const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
const at = (phase: ScorePhase, over: Partial<ScoreVerbState> = {}): ScoreVerbState =>
  ({ ...INITIAL_SCORE, request: 'jazz', status: { state: 'eligible', baseVersion: 2, versions: 2 }, phase, ...over });

describe('dockLines', () => {
  it('asking with a pick: the placeholder and the asking line name it', () => {
    const lines = dockLines(at({ kind: 'asking' }, { pick: CHORUS2 }), 0);
    expect(lines.placeholder).toBe('Describe the change to CHORUS 2, e.g. make this jazzier');
    expect(lines.consequence).toBe(`${ASKING_CONSEQUENCE} · “this” means CHORUS 2, bars 29–36`);
  });
  it('REVISING: plan 1 stays if it fails, and the job line says REVISING', () => {
    const lines = dockLines(at({ kind: 'planning', attempt: 1, note: null, cancelling: false }, { previous: P1, revising: true }), 0);
    expect(lines.consequence).toMatch(/^asks the planner with the plan above .* plan 1 stays if this fails$/);
    expect(lines.job).toBe('REVISING… attempt 1 of 3 · plan 1 is kept if it fails');
  });
  it('a failed REVISE keeps the plan appliable: its consequence line, not the off one', () => {
    expect(dockLines(at({ kind: 'ready' }, { plan: P1, reviseFailed: ['x'] }), 0).consequence).toMatch(/^Saves base v3/);
  });
  it('a stale pick: nothing was saved, APPLY & RENDER off', () => {
    expect(dockLines(at({ kind: 'asking' }, { pick: CHORUS2, stale: { picked: CHORUS2, now: null, reason: 'gone' } }), 0).consequence).toBe(CHECK_FAILED_CONSEQUENCE);
    expect(dockLines(at({ kind: 'ready' }, { plan: P1, stale: { picked: CHORUS2, now: null, reason: 'gone' } }), 0).consequence).toBe(CHECK_FAILED_CONSEQUENCE);
  });
});
