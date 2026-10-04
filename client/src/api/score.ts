/** Score slice (PLAN.md "Score Agent", F-021, F-024): the SCORE verb's status, PLAN, the plan
 * run it polls, and CANCEL. The plan itself stays on the server; only its view comes back. */
import { json } from './http';

export interface ScoreReading { bars: number; seconds: number; bpm: number; key: string; meter: string; tokens: number | null }

/** GET /api/songs/:id/score. `offline` says which backend is down: yue-server's score checker or
 * the Ollama planner. `baseVersion` is the active base version's number (v2). */
export interface ScoreStatusView {
  state: 'hidden' | 'ineligible' | 'offline' | 'eligible';
  reason?: string;
  offline?: 'checker' | 'planner';
  reading?: ScoreReading | null;
  baseVersion?: number | null;
  versions?: number;
  style?: string | null;
}

export interface ScoreChord { bar: number; beat: number; root: string; quality: string; bass?: string }

export type ScoreOp =
  | { op: 'SET_TEMPO'; bpm: number }
  | { op: 'REHARMONIZE'; from_bar: number; to_bar: number; chords: ScoreChord[] }
  | { op: 'EDIT_STYLE'; style: string };

export interface ScoreOpVerdict { index: number; op: string; ok: boolean; reason: string | null }

export interface ScorePlan {
  id: string;
  songId: string;
  baseVersionId: string;
  request: string;
  ops: ScoreOp[];
  verdicts: ScoreOpVerdict[];
  style: string;
  checks: {
    bars: number; seconds: number | null; tokens: number | null; chordsPresent: boolean | null;
    changed: { abc: boolean; style: boolean };
  };
  attempts: number;
  createdAt: number;
}

/** Why a run ended without a plan; null while it runs (or holds the slot to unload) or once planned. */
export type PlanCause = 'check' | 'offline' | 'refused' | 'cancelled';

export interface ScorePlanRun {
  jobId: string;
  request: string;
  status: 'queued' | 'loading' | 'running' | 'done' | 'failed';
  progressText?: string;
  queuePosition?: number;
  error?: string;
  reasons: string[];
  planId: string | null;
  cancelled?: boolean;
  cause: PlanCause | null;
}

export interface ScorePlanState { run: ScorePlanRun | null; plan: ScorePlan | null }

const post = (url: string, body?: unknown) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

export const scoreApi = {
  scoreStatus: (songId: string): Promise<ScoreStatusView> => fetch(`/api/songs/${songId}/score`).then((r) => json<ScoreStatusView>(r)),

  scorePlanState: (songId: string): Promise<ScorePlanState> =>
    fetch(`/api/songs/${songId}/score/plan`).then((r) => json<ScorePlanState>(r)),

  /** 202 with the job; 409 names why not (ineligible, a plan already running, queue full). */
  startScorePlan: (songId: string, request: string): Promise<{ jobId: string; queuePosition: number }> =>
    post(`/api/songs/${songId}/score/plan`, { request }).then((r) => json(r)),

  /** Queued: leaves the line. Running: aborts the planner call; the slot frees after the unload. */
  cancelScorePlan: (songId: string): Promise<{ ok: true; cancelled?: true; aborted?: true }> =>
    post(`/api/songs/${songId}/score/plan/cancel`).then((r) => json(r)),
};
