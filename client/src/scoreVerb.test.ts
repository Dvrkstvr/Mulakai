/** Every transition of the SCORE verb (pipeline/scope.md "Interaction specs › SCORE verb"; F-021,
 * F-022, F-024): one row per transition, plus the events a state must ignore. */
import { describe, it, expect } from 'vitest';
import { scoreVerb } from './scoreVerb';
import { INITIAL_SCORE, type ScoreEvent, type ScorePhase, type ScoreVerbState } from './scoreVerbTypes';
import type { ScorePlan, ScorePlanRun, ScoreStatusView } from './api';

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
