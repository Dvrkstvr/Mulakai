/** The SCORE verb's states and events (pipeline/scope.md "Interaction specs › SCORE verb";
 * pipeline/design/score-verb.html). Only `scoreVerb.ts` moves between them. */
import type { ScorePlan, ScorePlanRun, ScoreStatusView } from './api';

export type ScorePhase =
  /** No tab: not a YuE2 first take, or the feature is not set up (or not known yet). */
  | { kind: 'hidden' }
  | { kind: 'ineligible'; reason: string }
  /** `source` names the backend: yue-server's score checker or the Ollama planner. */
  | { kind: 'offline'; reason: string; source: 'checker' | 'planner' }
  | { kind: 'asking' }
  | { kind: 'queued'; ahead: number }
  /** `note` is the retry's reason or the unload; `cancelling` while CANCEL waits for the unload. */
  | { kind: 'planning'; attempt: number; note: string | null; cancelling: boolean }
  | { kind: 'ready' }
  | { kind: 'checkFailed'; reasons: string[] }
  /** Refused at APPLY & RENDER (plan expired, song changed): nothing started. */
  | { kind: 'stale'; reason: string }
  | { kind: 'renderQueued'; ahead: number }
  /** `line` is YuE2's stage and its share ("synthesizing audio 41%"); `startedAt` is when it took the slot. */
  | { kind: 'rendering'; line: string; startedAt: number | null }
  | { kind: 'renderFailed'; error: string }
  | { kind: 'done'; saved: string; truncated: boolean };

export interface ScoreVerbState {
  phase: ScorePhase;
  /** The request field; kept through cancel, failure and offline, cleared after a render. */
  request: string;
  /** The server's last answer: the reading line and the version numbers. */
  status: ScoreStatusView | null;
  /** The plan under review (ready, and the render states it belongs to). */
  plan: ScorePlan | null;
  /** The plan being replaced, shown dimmed until the new one arrives (DT-5); dropped on failure (D-028). */
  previous: ScorePlan | null;
  /** A refused PLAN (409, queue full): a rust line under the commit. */
  error: string | null;
}

export type ScoreEvent =
  | { type: 'status'; status: ScoreStatusView }
  | { type: 'edit'; request: string }
  /** POST plan answered 202; `ahead` = its queue position (0 = started). */
  | { type: 'planSubmitted'; ahead: number }
  | { type: 'planRefused'; error: string }
  /** A poll of the plan run while queued or planning. */
  | { type: 'run'; run: ScorePlanRun; plan: ScorePlan | null }
  /** SCORE opened again (reload, another song and back): pick up a run in flight or a stored plan. */
  | { type: 'restore'; run: ScorePlanRun | null; plan: ScorePlan | null }
  | { type: 'cancel' }
  | { type: 'renderSubmitted'; ahead: number }
  | { type: 'renderRefused'; reason: string }
  | { type: 'renderProgress'; ahead: number; line: string; startedAt: number | null }
  | { type: 'renderDone'; saved: string; truncated: boolean }
  | { type: 'renderFailed'; error: string }
  | { type: 'renderCancelled' };

export const INITIAL_SCORE: ScoreVerbState = { phase: { kind: 'hidden' }, request: '', status: null, plan: null, previous: null, error: null };
