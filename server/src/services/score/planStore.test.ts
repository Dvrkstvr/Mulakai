import { describe, it, expect, beforeEach } from 'vitest';
import { dropPlan, getPlan, getPlanById, lastRun, noteRun, resetPlans, setPlan } from './planStore.js';
import type { Plan } from './planTypes.js';

const plan = (id: string, songId = 's1'): Plan => ({
  id, songId, baseVersionId: 'v1', fingerprint: 'l1|v1|v1', request: 'r', ops: [], verdicts: [], abc: '', style: '',
  checks: { bars: 65, seconds: 179, tokens: 1832, chordsPresent: true, changed: { abc: true, style: false } }, attempts: 1, createdAt: 0,
});

beforeEach(() => resetPlans());

describe('planStore (D-035)', () => {
  it('keeps one plan per song: a new plan replaces the old one, whose id then expires', () => {
    setPlan(plan('p1'));
    setPlan(plan('p2'));
    expect(getPlan('s1')?.id).toBe('p2');
    expect(getPlanById('p1')).toBeUndefined();
    expect(getPlanById('p2')?.songId).toBe('s1');
  });

  it('keeps songs apart and drops one on request', () => {
    setPlan(plan('p1', 's1'));
    setPlan(plan('p2', 's2'));
    dropPlan('s1');
    expect(getPlan('s1')).toBeUndefined();
    expect(getPlan('s2')?.id).toBe('p2');
  });

  it("remembers each song's latest run", () => {
    noteRun('s1', { jobId: 'j1', request: 'r', reasons: [], planId: null });
    noteRun('s1', { jobId: 'j2', request: 'r', reasons: ['x'], planId: null });
    expect(lastRun('s1')).toEqual({ jobId: 'j2', request: 'r', reasons: ['x'], planId: null });
  });
});
