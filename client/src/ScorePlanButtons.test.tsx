/** PLAN and REVISE side by side (M2-5, Q-042 A): REVISE only while a plan is under review or being revised. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ScorePlan } from './api';
import { ScorePlanButtons } from './ScorePlanButtons';
import { INITIAL_SCORE, type ScoreVerbState } from './scoreVerbTypes';

const P1 = { id: 'p1', request: 'jazz' } as ScorePlan;
const html = (over: Partial<ScoreVerbState>) =>
  renderToStaticMarkup(<ScorePlanButtons state={{ ...INITIAL_SCORE, phase: { kind: 'ready' }, request: 'jazz', ...over }} onPlan={vi.fn()} onRevise={vi.fn()} />);

describe('ScorePlanButtons', () => {
  it('no plan: PLAN alone', () => {
    const out = html({ phase: { kind: 'asking' } });
    expect(out).toContain('PLAN');
    expect(out).not.toContain('REVISE');
  });
  it('a plan under review: REVISE beside PLAN, off until the request changes', () => {
    expect(html({ plan: P1 })).toMatch(/<button[^>]*disabled=""[^>]*title="change the request to revise the plan above"[^>]*><span>REVISE/);
    expect(html({ plan: P1, request: 'not so many chords' })).toMatch(/<button type="button" class="acid-outline dock-commit-btn"><span>REVISE/);
  });
  it('while revising: REVISE stays, off', () => {
    expect(html({ phase: { kind: 'planning', attempt: 1, note: null, cancelling: false }, previous: P1, revising: true })).toMatch(/disabled=""[^>]*><span>REVISE/);
  });
});
