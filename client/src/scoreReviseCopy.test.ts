/** SCORE's REVISE copy (score-m2.html frames 6-9, M2-5..M2-7). */
import { describe, expect, it } from 'vitest';
import type { ScorePlan } from './api';
import { jobLine } from './scoreCopy';
import {
  DROPPED_BY_PLAN, keptLabel, markOf, planTitle, removedLine, reviseConsequence, reviseFailedTail, reviseJobLine, sinceLine,
} from './scoreReviseCopy';

const P1 = { id: 'p1', request: 'jazz', ops: [{ op: 'SET_TEMPO', bpm: 88 }, { op: 'EDIT_STYLE', style: 'jazz' }, { op: 'SET_TEMPO', bpm: 90 }] } as ScorePlan;
const P2: ScorePlan = {
  ...P1, id: 'p2', revision: 2, ops: [{ op: 'SET_TEMPO', bpm: 88 }, { op: 'REHARMONIZE', from_bar: 13, to_bar: 20, chords: [] }],
  referent: { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] },
  since: { planId: 'p1', marks: [{ mark: 'SAME', was: { op: 'SET_TEMPO', bpm: 88 } }, { mark: 'CHANGED', was: null }], removed: [{ op: 'EDIT_STYLE', style: 'jazz' }] },
};

describe('REVISE copy', () => {
  it('the header names the revision and what it was made for', () => {
    expect(planTitle(P1, 2)).toBe('PLAN · 3 CHANGES · AGAINST BASE v2');
    expect(planTitle(P2, 2)).toBe('PLAN 2 · REVISED FROM PLAN 1 · 2 CHANGES · AGAINST BASE v2 · FOR CHORUS 2 (BARS 29–36)');
  });
  it('marks per op, the since line and the removed ops (M2-6)', () => {
    expect([markOf(P2, 0), markOf(P2, 1), markOf(P1, 0)]).toEqual(['SAME', 'CHANGED', null]);
    expect(sinceLine(P2)).toBe('SINCE PLAN 1 · 1 CHANGED · 1 SAME · 1 REMOVED');
    expect(sinceLine(P1)).toBeNull();
    expect(removedLine(P2, [{ name: 'EDIT STYLE', detail: '+ jazz' }])).toBe('REMOVED SINCE PLAN 1 · EDIT STYLE + jazz');
    expect(removedLine({ ...P2, since: { ...P2.since!, removed: [] } }, [])).toBeNull();
  });
  it('REVISING: the kept plan, the consequence and the job line (frame 6)', () => {
    expect(keptLabel(P1)).toBe('PLAN 1 · KEPT IF THE REVISE FAILS');
    expect(reviseConsequence(P1)).toBe('asks the planner with the plan above · uses the GPU for ~10 s · changes nothing yet · plan 1 stays if this fails');
    const planning = jobLine({ kind: 'planning', attempt: 1, note: null, cancelling: false });
    expect(reviseJobLine(planning, P1)).toBe('REVISING… attempt 1 of 3 · plan 1 is kept if it fails');
    expect(reviseJobLine(jobLine({ kind: 'queued', ahead: 2 }), P1)).toBe('REVISING · QUEUED · STARTS AFTER 2 JOBS');
    expect(reviseJobLine(jobLine({ kind: 'planning', attempt: 1, note: null, cancelling: true }), P1)).toMatch(/^CANCELLING…/);
  });
  it('the two failures read differently (M2-7)', () => {
    expect(reviseFailedTail(P2)).toBe('Plan 2 is still here: change the request and REVISE, or APPLY & RENDER plan 2.');
    expect(DROPPED_BY_PLAN).toContain('REVISE would have kept it');
  });
});
