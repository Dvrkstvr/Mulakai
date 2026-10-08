/** Every transition of the SCORE verb (pipeline/scope.md "Interaction specs › SCORE verb"; F-021,
 * F-022, F-024): one row per transition, plus the events a state must ignore. */
import { describe, it, expect } from 'vitest';
import { canPlan, canRender, canRevise, scoreVerb } from './scoreVerb';
import { INITIAL_SCORE, type ScoreEvent, type ScorePhase, type ScoreVerbState } from './scoreVerbTypes';
import type { ScorePlan, ScorePlanRun, ScoreReferent, ScoreStaleReferent, ScoreStatusView } from './api';

const plan = (id: string, request = 'jazz chords in the chorus, 88 BPM'): ScorePlan => ({
  id, songId: 's1', baseVersionId: 'v2', request, ops: [{ op: 'SET_TEMPO', bpm: 88 }],
  verdicts: [{ index: 1, op: 'SET_TEMPO', ok: true, reason: null }], style: 'pop, 88 bpm',
  checks: { bars: 65, seconds: 183, tokens: 1520, chordsPresent: true, changed: { abc: true, style: true } }, attempts: 1, refusals: [], createdAt: 1,
});
const P1 = plan('p1');
const P2 = plan('p2', 'jazz chords in the chorus, 90 BPM');
const run = (over: Partial<ScorePlanRun>): ScorePlanRun => ({ jobId: 'j', request: 'jazz', status: 'running', reasons: [], planId: null, cause: null, ...over });
const eligible: ScoreStatusView = { state: 'eligible', baseVersion: 2, versions: 2, reading: null };

const at = (phase: ScorePhase, over: Partial<ScoreVerbState> = {}): ScoreVerbState =>
  ({ ...INITIAL_SCORE, request: 'jazz', status: eligible, phase, ...over });
const asking = at({ kind: 'asking' });
const planning = at({ kind: 'planning', attempt: 1, note: null, cancelling: false });
const ready = at({ kind: 'ready' }, { plan: P1 });
const replanning = at({ kind: 'planning', attempt: 1, note: null, cancelling: false }, { previous: P1 });
const rendering = at({ kind: 'rendering', line: 'synthesizing audio 41%', startedAt: 5 }, { plan: P1 });
const renderFailed = at({ kind: 'renderFailed', error: 'CUDA out of memory' }, { plan: P1 });

// F-032 / F-033 (M2): the pick, a stale pick, REVISE
const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
const STALE: ScoreStaleReferent = { picked: CHORUS2, now: { ...CHORUS2, section: 6, bars: [37, 44] }, reason: 'chorus #2 was bars 29-36 and is now bars 37-44' };
const R2: ScorePlan = { ...P2, revision: 2, since: { planId: 'p1', marks: [{ mark: 'CHANGED', was: P1.ops[0] }], removed: [] } };
const PLANNING1: ScorePhase = { kind: 'planning', attempt: 1, note: null, cancelling: false };
const revising = at(PLANNING1, { previous: P1, revising: true });

type Row = [string, ScoreVerbState, ScoreEvent, Partial<ScoreVerbState>];

const ROWS: Row[] = [
  // hidden ⇄ ineligible / offline / asking: on load, on a song change, on a probe result
  ['hidden → hidden (not a YuE2 song)', INITIAL_SCORE, { type: 'status', status: { state: 'hidden' } }, { phase: { kind: 'hidden' } }],
  ['hidden → ineligible with the reason', INITIAL_SCORE, { type: 'status', status: { state: 'ineligible', reason: 'This song has a repaint version, so score editing ended when it was made.' } },
    { phase: { kind: 'ineligible', reason: 'This song has a repaint version, so score editing ended when it was made.' } }],
  ['hidden → offline (planner)', INITIAL_SCORE, { type: 'status', status: { state: 'offline', offline: 'planner', reason: "model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'" } },
    { phase: { kind: 'offline', source: 'planner', reason: "model qwen3:14b is not on the planner: run 'ollama pull qwen3:14b'" } }],
  ['hidden → offline (score checker)', INITIAL_SCORE, { type: 'status', status: { state: 'offline', offline: 'checker', reason: 'Score checker unreachable' } },
    { phase: { kind: 'offline', source: 'checker', reason: 'Score checker unreachable' } }],
  ['hidden → asking (eligible)', INITIAL_SCORE, { type: 'status', status: eligible }, { phase: { kind: 'asking' }, status: eligible }],
  ['ineligible → asking', at({ kind: 'ineligible', reason: 'x' }), { type: 'status', status: eligible }, { phase: { kind: 'asking' } }],
  ['offline → asking on RECHECK, the request kept', at({ kind: 'offline', reason: 'x', source: 'planner' }), { type: 'status', status: eligible }, { phase: { kind: 'asking' }, request: 'jazz' }],
  ['asking → hidden (another song)', asking, { type: 'status', status: { state: 'hidden' } }, { phase: { kind: 'hidden' } }],
  ['ready → ineligible drops the plan (a version was added)', ready, { type: 'status', status: { state: 'ineligible', reason: 'r' } }, { phase: { kind: 'ineligible', reason: 'r' }, plan: null }],
  ['planning keeps planning when the status says eligible', planning, { type: 'status', status: eligible }, { phase: planning.phase }],
  // asking → PLAN → queued | planning; queued → planning
  ['asking → queued (GPU busy)', asking, { type: 'planSubmitted', ahead: 2 }, { phase: { kind: 'queued', ahead: 2 } }],
  ['asking → planning (slot free)', asking, { type: 'planSubmitted', ahead: 0 }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false } }],
  ['queued → queued, closer', at({ kind: 'queued', ahead: 2 }), { type: 'run', run: run({ status: 'queued', queuePosition: 1 }), plan: null }, { phase: { kind: 'queued', ahead: 1 } }],
  ['queued → planning when the slot frees', at({ kind: 'queued', ahead: 1 }), { type: 'run', run: run({ progressText: 'attempt 1 of 3' }), plan: null },
    { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false } }],
  ['planning → a retry shows its reason', planning, { type: 'run', run: run({ progressText: 'attempt 2 of 3 · bar 5 had 31/32 units' }), plan: null },
    { phase: { kind: 'planning', attempt: 2, note: 'bar 5 had 31/32 units', cancelling: false } }],
  ['planning → the unload keeps the attempt', at({ kind: 'planning', attempt: 2, note: 'x', cancelling: false }), { type: 'run', run: run({ progressText: 'unloading the planner' }), plan: null },
    { phase: { kind: 'planning', attempt: 2, note: 'unloading the planner', cancelling: false } }],
  // planning → plan ready | check failed | offline | asking (CANCEL)
  ['planning → plan ready', planning, { type: 'run', run: run({ status: 'done', planId: 'p1' }), plan: P1 }, { phase: { kind: 'ready' }, plan: P1, previous: null }],
  ['planning → check failed after 3 attempts, one line per cause', planning,
    { type: 'run', run: run({ status: 'failed', cause: 'check', reasons: ['estimated 458 s: over the 360 s limit; at least 112 BPM fits'] }), plan: null },
    { phase: { kind: 'checkFailed', reasons: ['estimated 458 s: over the 360 s limit; at least 112 BPM fits'] }, plan: null }],
  ['planning → offline when the planner stops answering, the request kept', planning,
    { type: 'run', run: run({ status: 'failed', cause: 'offline', reasons: ['planner offline: no answer'] }), plan: null },
    { phase: { kind: 'offline', source: 'planner', reason: 'planner offline: no answer' }, request: 'jazz' }],
  ['planning → ineligible when the song changed while queued', planning, { type: 'run', run: run({ status: 'failed', cause: 'refused', reasons: ['This song has 2 layers'] }), plan: null },
    { phase: { kind: 'ineligible', reason: 'This song has 2 layers' } }],
  ['planning → CANCEL waits for the unload', planning, { type: 'cancel' }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: true } }],
  ['cancelling stays while the slot is held (failed, no cause yet)', at({ kind: 'planning', attempt: 1, note: null, cancelling: true }),
    { type: 'run', run: run({ status: 'failed', error: 'Aborted' }), plan: null }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: true } }],
  ['cancelling → asking, text kept, no plan', at({ kind: 'planning', attempt: 1, note: null, cancelling: true }, { previous: P1 }),
    { type: 'run', run: run({ status: 'failed', cause: 'cancelled' }), plan: null }, { phase: { kind: 'asking' }, request: 'jazz', plan: null, previous: null }],
  ['queued → CANCEL → asking, text kept', at({ kind: 'queued', ahead: 1 }), { type: 'cancel' }, { phase: { kind: 'asking' }, request: 'jazz' }],
  ['queued → asking when the server cancelled it', at({ kind: 'queued', ahead: 1 }), { type: 'run', run: run({ status: 'failed', cancelled: true, cause: 'cancelled' }), plan: null }, { phase: { kind: 'asking' } }],
  // plan ready / check failed → edit + PLAN → planning, the old plan dimmed (DT-5, D-028)
  ['ready → edit keeps the plan', ready, { type: 'edit', request: 'jazz, 90 BPM' }, { phase: { kind: 'ready' }, plan: P1, request: 'jazz, 90 BPM' }],
  ['ready → PLAN again dims the old plan', ready, { type: 'planSubmitted', ahead: 0 }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false }, plan: null, previous: P1 }],
  ['re-planning → the new plan replaces the dimmed one', replanning, { type: 'run', run: run({ status: 'done' }), plan: P2 }, { phase: { kind: 'ready' }, plan: P2, previous: null }],
  ['a failed re-plan drops the dimmed plan', replanning, { type: 'run', run: run({ status: 'failed', cause: 'check', reasons: ['x'] }), plan: null }, { previous: null, plan: null }],
  ['check failed → PLAN again', at({ kind: 'checkFailed', reasons: ['x'] }), { type: 'planSubmitted', ahead: 0 }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false }, previous: null }],
  ['a refused PLAN is a rust line; editing clears it', asking, { type: 'planRefused', error: 'the queue is full' }, { phase: { kind: 'asking' }, error: 'the queue is full' }],
  ['edit clears the refusal', at({ kind: 'asking' }, { error: 'x' }), { type: 'edit', request: 'y' }, { error: null, request: 'y' }],
  // plan ready → APPLY & RENDER → stale | render queued → rendering → done | render failed | plan ready (CANCEL)
  ['ready → stale (plan expired), plan kept for the dimmed list', ready, { type: 'renderRefused', reason: 'plan expired: the server restarted' }, { phase: { kind: 'stale', reason: 'plan expired: the server restarted' }, plan: P1 }],
  ['stale → PLAN AGAIN', at({ kind: 'stale', reason: 'x' }, { plan: P1 }), { type: 'planSubmitted', ahead: 0 }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false }, plan: null, previous: P1 }],
  ['ready → render queued', ready, { type: 'renderSubmitted', ahead: 1 }, { phase: { kind: 'renderQueued', ahead: 1 }, plan: P1 }],
  ['ready → rendering', ready, { type: 'renderSubmitted', ahead: 0 }, { phase: { kind: 'rendering', line: '', startedAt: null } }],
  ['render queued → rendering', at({ kind: 'renderQueued', ahead: 1 }, { plan: P1 }), { type: 'renderProgress', ahead: 0, line: 'generating song tokens 3%', startedAt: 9 },
    { phase: { kind: 'rendering', line: 'generating song tokens 3%', startedAt: 9 } }],
  ['render failed → RETRY RENDER → rendering, the same plan', renderFailed, { type: 'renderSubmitted', ahead: 0 }, { phase: { kind: 'rendering', line: '', startedAt: null }, plan: P1 }],
  ['render failed → RETRY RENDER refused → stale', renderFailed, { type: 'renderRefused', reason: 'this song changed since the plan' },
    { phase: { kind: 'stale', reason: 'this song changed since the plan' }, plan: P1 }],
  ['render queued → refused at its turn → stale, nothing started', at({ kind: 'renderQueued', ahead: 1 }, { plan: P1 }), { type: 'renderRefused', reason: 'this song changed since the plan' },
    { phase: { kind: 'stale', reason: 'this song changed since the plan' } }],
  ['rendering → done clears the field and the plan', rendering, { type: 'renderDone', saved: 'Saved base v3 · 88.1 BPM, 3:04', truncated: false },
    { phase: { kind: 'done', saved: 'Saved base v3 · 88.1 BPM, 3:04', truncated: false }, request: '', plan: null }],
  ['rendering → done but truncated', rendering, { type: 'renderDone', saved: 'v3', truncated: true }, { phase: { kind: 'done', saved: 'v3', truncated: true } }],
  ['rendering → render failed keeps the plan', rendering, { type: 'renderFailed', error: 'CUDA out of memory' }, { phase: { kind: 'renderFailed', error: 'CUDA out of memory' }, plan: P1 }],
  ['rendering → CANCEL → plan ready again', rendering, { type: 'renderCancelled' }, { phase: { kind: 'ready' }, plan: P1 }],
  ['done → typing and PLAN start the next plan', at({ kind: 'done', saved: 'v3', truncated: false }), { type: 'planSubmitted', ahead: 0 }, { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false } }],
  // reopening SCORE rehydrates from the server
  ['restore a running plan with its request', at({ kind: 'asking' }, { request: '' }), { type: 'restore', run: run({ request: 'jazz chords', progressText: 'attempt 1 of 3' }), plan: null },
    { phase: { kind: 'planning', attempt: 1, note: null, cancelling: false }, request: 'jazz chords' }],
  ['restore a queued plan', at({ kind: 'asking' }, { request: '' }), { type: 'restore', run: run({ status: 'queued', queuePosition: 2 }), plan: null }, { phase: { kind: 'queued', ahead: 2 } }],
  ['restore a stored plan', at({ kind: 'asking' }, { request: '' }), { type: 'restore', run: run({ status: 'done' }), plan: P1 }, { phase: { kind: 'ready' }, plan: P1, request: P1.request }],
  // F-032: the pick ("this"), pinned per press; a stale pick is never planned (M2-1..M2-4)
  ['asking → a strip section becomes the pick', asking, { type: 'pick', pick: CHORUS2 }, { phase: { kind: 'asking' }, pick: CHORUS2 }],
  ['planning → a pick only moves the chip', planning, { type: 'pick', pick: CHORUS2 }, { phase: planning.phase, pick: CHORUS2 }],
  ['ready → ✕ clears the pick, the plan stays', at({ kind: 'ready' }, { plan: P1, pick: CHORUS2 }), { type: 'pick', pick: null }, { pick: null, plan: P1 }],
  ['asking → a 409 stale pick: the rejected row, nothing queued', at({ kind: 'asking' }, { pick: CHORUS2 }), { type: 'planStale', stale: STALE }, { phase: { kind: 'asking' }, stale: STALE }],
  ['stale → USE BARS re-picks where it is now', at({ kind: 'asking' }, { pick: CHORUS2, stale: STALE }), { type: 'pick', pick: STALE.now }, { pick: STALE.now, stale: null }],
  ['stale → WHOLE SCORE clears the pick', at({ kind: 'asking' }, { pick: CHORUS2, stale: STALE }), { type: 'pick', pick: null }, { pick: null, stale: null }],
  ['planning → stale by the job turn (run.stale)', planning, { type: 'run', run: run({ status: 'failed', cause: 'refused', reasons: ['the selection is stale'], stale: STALE }), plan: null },
    { phase: { kind: 'asking' }, stale: STALE, plan: null }],
  ['a fresh PLAN that fails drops the plan and says so (D-028, frame 9)', replanning, { type: 'run', run: run({ status: 'failed', cause: 'check', reasons: ['x'] }), plan: null },
    { phase: { kind: 'checkFailed', reasons: ['x'], dropped: true }, plan: null, previous: null }],
  ['PLAN clears the stale row and a failed REVISE line', at({ kind: 'ready' }, { plan: P1, reviseFailed: ['x'], stale: STALE }), { type: 'planSubmitted', ahead: 0 },
    { phase: PLANNING1, reviseFailed: null, stale: null, revising: false, previous: P1 }],
  // F-033: REVISE keeps plan 1 until plan 2 arrives, and gives it back if it fails (M2-5..M2-7, D-063)
  ['ready → REVISE → revising, plan 1 kept dimmed', ready, { type: 'planSubmitted', ahead: 0, revise: true }, { phase: PLANNING1, plan: null, previous: P1, revising: true }],
  ['ready → REVISE queued', ready, { type: 'planSubmitted', ahead: 2, revise: true }, { phase: { kind: 'queued', ahead: 2 }, previous: P1, revising: true }],
  ['revising → plan 2 replaces plan 1', revising, { type: 'run', run: run({ status: 'done' }), plan: R2 }, { phase: { kind: 'ready' }, plan: R2, previous: null, revising: false }],
  ['revising → check failed keeps plan 1 appliable, with why', revising, { type: 'run', run: run({ status: 'failed', cause: 'check', reasons: ['bar 15 had 30/32 units'] }), plan: null },
    { phase: { kind: 'ready' }, plan: P1, previous: null, revising: false, reviseFailed: ['bar 15 had 30/32 units'] }],
  ['revising → refused (plan replaced) keeps plan 1', revising, { type: 'run', run: run({ status: 'failed', cause: 'refused', reasons: ['that plan was replaced'] }), plan: null },
    { phase: { kind: 'ready' }, plan: P1, reviseFailed: ['that plan was replaced'] }],
  ['revising → offline keeps plan 1', revising, { type: 'run', run: run({ status: 'failed', cause: 'offline', reasons: ['planner offline: no answer'] }), plan: null },
    { phase: { kind: 'ready' }, plan: P1, reviseFailed: ['planner offline: no answer'] }],
  ['revising → CANCEL settled: plan 1 back, no failure line', at({ kind: 'planning', attempt: 1, note: null, cancelling: true }, { previous: P1, revising: true }),
    { type: 'run', run: run({ status: 'failed', cause: 'cancelled' }), plan: null }, { phase: { kind: 'ready' }, plan: P1, reviseFailed: null, revising: false }],
  ['revising → stale by its turn keeps plan 1, the rejected row shown', revising,
    { type: 'run', run: run({ status: 'failed', cause: 'refused', reasons: ['the selection is stale'], stale: STALE }), plan: null },
    { phase: { kind: 'ready' }, plan: P1, stale: STALE, reviseFailed: null }],
  ['REVISE queued → CANCEL → plan 1 under review again', at({ kind: 'queued', ahead: 1 }, { previous: P1, revising: true }), { type: 'cancel' },
    { phase: { kind: 'ready' }, plan: P1, previous: null, revising: false }],
  ['a failed REVISE → APPLY & RENDER plan 1 clears the failure line', at({ kind: 'ready' }, { plan: P1, reviseFailed: ['x'] }), { type: 'renderSubmitted', ahead: 0 },
    { phase: { kind: 'rendering', line: '', startedAt: null }, plan: P1, reviseFailed: null }],
  ['restore a REVISE in flight: plan 1 kept, revising', at({ kind: 'asking' }, { request: '' }), { type: 'restore', run: run({ revise: 'p1', progressText: 'attempt 1 of 3' }), plan: P1 },
    { phase: PLANNING1, previous: P1, revising: true }],
  ['restore a plan made for a pick: the chip shows it', at({ kind: 'asking' }, { request: '' }), { type: 'restore', run: run({ status: 'done' }), plan: { ...P1, referent: CHORUS2 } },
    { phase: { kind: 'ready' }, pick: CHORUS2 }],
];

const IGNORED: Row[] = [
  ['PLAN while hidden', INITIAL_SCORE, { type: 'planSubmitted', ahead: 0 }, {}],
  ['PLAN while planning', planning, { type: 'planSubmitted', ahead: 0 }, {}],
  ['a stale poll while asking', asking, { type: 'run', run: run({ status: 'done' }), plan: P1 }, {}],
  ['restore while a plan is under review', ready, { type: 'restore', run: null, plan: P2 }, {}],
  ['a failed run on restore', asking, { type: 'restore', run: run({ status: 'failed', cause: 'check', reasons: ['x'] }), plan: null }, {}],
  ['APPLY & RENDER outside plan ready', asking, { type: 'renderSubmitted', ahead: 0 }, {}],
  ['APPLY & RENDER while rendering', rendering, { type: 'renderSubmitted', ahead: 0 }, {}],
  ['a render poll after done', at({ kind: 'done', saved: 'v3', truncated: false }), { type: 'renderProgress', ahead: 0, line: 'x', startedAt: 1 }, {}],
  ['CANCEL while asking', asking, { type: 'cancel' }, {}],
  ['REVISE with no plan under review', at({ kind: 'checkFailed', reasons: ['x'] }), { type: 'planSubmitted', ahead: 0, revise: true }, {}],
  ['REVISE while revising', revising, { type: 'planSubmitted', ahead: 0, revise: true }, {}],
];

describe('scoreVerb transitions', () => {
  it.each(ROWS)('%s', (_name, from, event, expected) => {
    expect(scoreVerb(from, event)).toMatchObject(expected);
  });
});

describe('scoreVerb ignores events a state has no transition for', () => {
  it.each(IGNORED)('%s', (_name, from, event) => {
    expect(scoreVerb(from, event)).toBe(from);
  });
});

describe('scoreVerb guards (M2)', () => {
  const plan1 = at({ kind: 'ready' }, { plan: P1, request: P1.request });
  it('REVISE is off while the request is the plan one, on once it changes (FILL included)', () => {
    expect(canRevise(plan1)).toBe(false);
    expect(canRevise({ ...plan1, request: `${P1.request}, cut the outro` })).toBe(true);
    expect(canRevise({ ...plan1, plan: null, request: 'other' })).toBe(false);
  });
  it('a strip section the score lacks holds PLAN and REVISE (rust chip, M2-2)', () => {
    const missing: ScoreVerbState = { ...plan1, request: 'other', pick: { kind: 'missing', label: 'Spoken Intro' } };
    expect(canPlan(missing)).toBe(false);
    expect(canRevise(missing)).toBe(false);
    expect(canPlan({ ...missing, pick: CHORUS2 })).toBe(true);
  });
  it('a stale pick holds APPLY & RENDER and REVISE, not PLAN (M2-4)', () => {
    const stale = { ...plan1, request: 'other', stale: STALE };
    expect(canRender(stale)).toBe(false);
    expect(canRevise(stale)).toBe(false);
    expect(canPlan(stale)).toBe(true);
    expect(canRender(plan1)).toBe(true);
  });
});

describe('RE-TIME (RT-4): a plan made at once, under review like a PLAN\'s', () => {
  const RT: ScorePlan = { ...plan('rt', 'RE-TIME HALF TIME · 93.7 → 47 BPM'), ops: [{ op: 'RETIME', mode: 'half', bpm: 47, from_bpm: 93.7, dropped_notes: 0, notes: 9 }] };
  it('lands as ready with no request text, so PLAN stays off and APPLY & RENDER is on', () => {
    const s = scoreVerb(asking, { type: 'retimed', plan: RT });
    expect(s).toMatchObject({ phase: { kind: 'ready' }, plan: RT, request: '', pick: null, error: null });
    expect(canRender(s)).toBe(true);
    expect(canPlan(s)).toBe(false);
    expect(scoreVerb(ready, { type: 'retimed', plan: RT }).plan).toBe(RT); // replaces a plan under review
  });
  it('is ignored while a plan or a render is in flight', () => {
    expect(scoreVerb(planning, { type: 'retimed', plan: RT })).toBe(planning);
    expect(scoreVerb(rendering, { type: 'retimed', plan: RT })).toBe(rendering);
  });
});
