/**
 * The SCORE verb's state machine (pipeline/scope.md "Interaction specs › SCORE verb"). Pure: the
 * store feeds it server answers and clicks, and the dock renders what it returns. An event a
 * state has no transition for returns the state unchanged (the same object).
 */
import type { ScorePlanRun, ScoreStatusView } from './api';
import type { ScoreEvent, ScorePhase, ScoreVerbState } from './scoreVerbTypes';

type Kind = ScorePhase['kind'];

/** Where PLAN can be pressed: the field is editable and no plan or render is in flight. */
const CAN_PLAN: Kind[] = ['asking', 'ready', 'checkFailed', 'stale', 'renderFailed', 'done'];
const PLANNING: Kind[] = ['queued', 'planning'];
const RENDERING: Kind[] = ['renderQueued', 'rendering'];
/** States the server's status decides by itself (nothing of the user's is in flight there). */
const SETTLED: Kind[] = ['hidden', 'ineligible', 'offline'];

const is = (s: ScoreVerbState, kinds: Kind[]) => kinds.includes(s.phase.kind);

export const canPlan = (s: ScoreVerbState) => is(s, CAN_PLAN) && s.request.trim().length > 0;

function fromStatus(s: ScoreVerbState, status: ScoreStatusView): ScoreVerbState {
  const next = { ...s, status };
  if (status.state === 'hidden') return { ...next, phase: { kind: 'hidden' }, plan: null, previous: null };
  if (status.state === 'ineligible') return { ...next, phase: { kind: 'ineligible', reason: status.reason ?? '' }, plan: null, previous: null };
  if (is(s, PLANNING) || is(s, RENDERING)) return next; // the job's own poll decides
  if (status.state === 'offline') return { ...next, phase: { kind: 'offline', reason: status.reason ?? '', source: status.offline ?? 'planner' } };
  return is(s, SETTLED) ? { ...next, phase: { kind: 'asking' } } : next;
}

/** "attempt 2 of 3 · bar 5 had 31/32 units" → 2 and the reason; other text (the unload) is a note. */
function planningPhase(s: ScoreVerbState, text: string | undefined): ScorePhase {
  const prev = s.phase.kind === 'planning' ? s.phase : { attempt: 1, cancelling: false };
  const m = text?.match(/^attempt (\d+) of \d+(?: · (.*))?$/);
  if (m) return { kind: 'planning', attempt: Number(m[1]), note: m[2] ?? null, cancelling: prev.cancelling };
  return { kind: 'planning', attempt: prev.attempt, note: text ?? null, cancelling: prev.cancelling };
}

/** A plan run's latest answer, applied to a state that is waiting on it. */
function fromRun(s: ScoreVerbState, run: ScorePlanRun, plan: ScoreVerbState['plan']): ScoreVerbState {
  if (run.status === 'queued') return { ...s, phase: { kind: 'queued', ahead: run.queuePosition ?? 1 } };
  if (run.status === 'loading' || run.status === 'running') return { ...s, phase: planningPhase(s, run.progressText) };
  if (run.status === 'done') return plan ? { ...s, phase: { kind: 'ready' }, plan, previous: null } : s;
  const cleared = { ...s, plan: null, previous: null };
  const reason = run.reasons[0] ?? run.error ?? 'the plan failed';
  switch (run.cause) {
    case 'cancelled': return { ...cleared, phase: { kind: 'asking' } };
    case 'check': return { ...cleared, phase: { kind: 'checkFailed', reasons: run.reasons.length ? run.reasons : [reason] } };
    case 'offline': return { ...cleared, phase: { kind: 'offline', reason, source: 'planner' } };
    case 'refused': return { ...cleared, phase: { kind: 'ineligible', reason } };
    default: return s; // aborted, but the slot is held until the unload is confirmed
  }
}

export function scoreVerb(s: ScoreVerbState, e: ScoreEvent): ScoreVerbState {
  switch (e.type) {
    case 'status':
      return fromStatus(s, e.status);
    case 'edit':
      return { ...s, request: e.request, error: null };
    case 'planSubmitted': {
      if (!is(s, CAN_PLAN)) return s;
      const phase: ScorePhase = e.ahead > 0 ? { kind: 'queued', ahead: e.ahead } : { kind: 'planning', attempt: 1, note: null, cancelling: false };
      return { ...s, phase, previous: s.plan, plan: null, error: null };
    }
    case 'planRefused':
      return { ...s, error: e.error };
    case 'run':
      return is(s, PLANNING) ? fromRun(s, e.run, e.plan) : s;
    case 'restore': {
      if (s.phase.kind !== 'asking') return s;
      const inFlight = e.run && ['queued', 'loading', 'running'].includes(e.run.status);
      if (inFlight && e.run) return fromRun({ ...s, request: e.run.request }, e.run, null);
      return e.plan ? { ...s, phase: { kind: 'ready' }, plan: e.plan, request: e.plan.request } : s;
    }
    case 'cancel':
      if (s.phase.kind === 'queued') return { ...s, phase: { kind: 'asking' }, previous: null };
      if (s.phase.kind === 'planning') return { ...s, phase: { ...s.phase, cancelling: true } };
      return s;
    case 'renderSubmitted':
      if (s.phase.kind !== 'ready') return s;
      return { ...s, phase: e.ahead > 0 ? { kind: 'renderQueued', ahead: e.ahead } : { kind: 'rendering', line: '' } };
    case 'renderRefused':
      return s.phase.kind === 'ready' ? { ...s, phase: { kind: 'stale', reason: e.reason } } : s;
    case 'renderProgress':
      if (!is(s, RENDERING)) return s;
      return { ...s, phase: e.ahead > 0 ? { kind: 'renderQueued', ahead: e.ahead } : { kind: 'rendering', line: e.line } };
    case 'renderDone':
      return is(s, RENDERING) ? { ...s, phase: { kind: 'done', saved: e.saved, truncated: e.truncated }, request: '', plan: null, previous: null } : s;
    case 'renderFailed':
      return is(s, RENDERING) ? { ...s, phase: { kind: 'renderFailed', error: e.error } } : s;
    case 'renderCancelled':
      return is(s, RENDERING) ? { ...s, phase: { kind: 'ready' } } : s;
  }
}
