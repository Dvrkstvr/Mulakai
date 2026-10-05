/** Score slice (PLAN.md "Score Agent", F-021, F-023, F-024): the SCORE verb's status, PLAN, the plan
 * run it polls, APPLY & RENDER and its render run, and CANCEL. The plan itself stays on the server;
 * only its view comes back. */
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

/** One WRITE_PHRASE note: an ABC pitch (or z for a rest) and its length in quarter-note beats. */
export interface ScorePhraseNote { pitch: string; beats: number }

export type ScoreOp =
  | { op: 'SET_TEMPO'; bpm: number }
  | { op: 'REHARMONIZE'; from_bar: number; to_bar: number; chords: ScoreChord[] }
  | { op: 'EDIT_STYLE'; style: string }
  | { op: 'WRITE_PHRASE'; start_bar: number; instrument: string; bars: ScorePhraseNote[][] };

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

/** The base version a render saved: v`number`, its length and the new score's tempo. */
export interface ScoreRenderVersion { id: string; number: number; seconds: number | null; bpm: number | null; truncated: boolean }

/** GET /api/songs/:id/score/render's run. `stage` + `progress` are YuE2's stage and that stage's
 * share; `cause` says why a failed run saved nothing (refused at its turn, CANCEL, the engine). */
export interface ScoreRenderRun {
  jobId: string;
  planId: string;
  status: 'queued' | 'loading' | 'running' | 'done' | 'failed';
  queuePosition?: number;
  stage?: string;
  progress?: number;
  startedAt?: number;
  error?: string;
  version: ScoreRenderVersion | null;
  cause: 'refused' | 'cancelled' | 'failed' | null;
}

/** 202 with the job, or the re-check's reason when nothing was started (a stale plan). */
export type ScoreRenderStart = { jobId: string; queuePosition: number } | { refused: string };

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

  /** APPLY & RENDER. A 409 the re-check made is `{refused}`; any other refusal throws (queue full, in flight). */
  startScoreRender: async (songId: string, planId: string): Promise<ScoreRenderStart> => {
    const res = await post(`/api/songs/${songId}/score/render`, { planId });
    if (res.status === 409) {
      const body = (await res.clone().json().catch(() => ({}))) as { error?: string; stale?: boolean };
      if (body.stale && body.error) return { refused: body.error };
    }
    return json(res);
  },

  scoreRenderState: (songId: string): Promise<{ run: ScoreRenderRun | null }> =>
    fetch(`/api/songs/${songId}/score/render`).then((r) => json(r)),

  /** Queued: leaves the line. Running: ABORT; the slot frees once YuE2 has stopped. */
  cancelScoreRender: (songId: string): Promise<{ ok: true; cancelled?: true; aborted?: true }> =>
    post(`/api/songs/${songId}/score/render/cancel`).then((r) => json(r)),
};
