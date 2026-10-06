/** Score slice (PLAN.md "Score Agent", F-021, F-023, F-024): the SCORE verb's status, PLAN, the plan
 * run it polls, APPLY & RENDER and its render run, and CANCEL. The plan itself stays on the server;
 * only its view comes back. */
import { json } from './http';
import type { ScoreLyricBlock, ScorePlanPress, ScorePlanStart, ScoreReferent, ScoreSection, ScoreSince, ScoreStaleReferent } from './scoreReferent';
export type * from './scoreReferent';

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
  /** The score's sections and lyric blocks as read, for a pick (F-032); absent from a server that does not send them. */
  sections?: ScoreSection[];
  blocks?: ScoreLyricBlock[];
}

export interface ScoreChord { bar: number; beat: number; root: string; quality: string; bass?: string }

/** One WRITE_PHRASE note: an ABC pitch (or z for a rest) and its length in quarter-note beats. */
export interface ScorePhraseNote { pitch: string; beats: number }

export type ScoreOp =
  | { op: 'SET_TEMPO'; bpm: number }
  | { op: 'REHARMONIZE'; from_bar: number; to_bar: number; chords: ScoreChord[] }
  | { op: 'EDIT_STYLE'; style: string }
  | { op: 'WRITE_PHRASE'; start_bar: number; instrument: string; bars: ScorePhraseNote[][] }
  /** M2 (F-029): every note and chord moves n semitones (-11..11); the key follows. */
  | { op: 'TRANSPOSE'; semitones: number }
  /** M2 (F-030): `section` is the read's S<n>, `label` its score label ("chorus") as a cross-check. */
  | { op: 'REPEAT' | 'CUT'; section: number; label: string }
  /** M2 (F-031): `block` is the lyric block's number, `tag` + `occurrence` ("[Chorus]", 2) the cross-check. */
  | { op: 'REWRITE_LYRICS'; block: number; tag: string; occurrence: number; lines: string[] };

/** REWRITE_LYRICS's verdict detail: the block it changed and its lines before and after (F-031 #1). */
export interface ScoreLyricDiff { block: number; tag: string; occurrence: number; old: string[]; new: string[] }

/** `note`: what a REPEAT / CUT did with the lyrics (F-030 #3); `diff`: a REWRITE_LYRICS's lines. */
export interface ScoreOpVerdict {
  index: number; op: string; ok: boolean; reason: string | null; note?: string | null; diff?: ScoreLyricDiff | null;
}

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
    changed: { abc: boolean; style: boolean; lyrics?: boolean };
  };
  attempts: number;
  /** Each earlier refused attempt's reasons, in order: empty when attempt 1 passed (D-060). */
  refusals: string[][];
  createdAt: number;
  /** What "this" meant, pinned at PLAN / REVISE (F-032, M2-3); null = the whole song. */
  referent?: ScoreReferent | null;
  /** 1 for a PLAN, +1 per REVISE (F-033). */
  revision?: number;
  /** A REVISE's marks against the plan it replaced (M2-6); null for a PLAN. */
  since?: ScoreSince | null;
  /** The render's YuE2 mode (F-065, D-132): chords read or added by a REHARMONIZE → full, else melody. */
  renderMode?: ScoreRenderMode;
}

export interface ScoreRenderMode { cot: 'full' | 'melody'; reason: 'chords' | 'reharmonize' | 'melody' }

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
  /** The plan id this run revises (F-033), null for a PLAN. */
  revise?: string | null;
  /** Set when the pick no longer matched the score by the job's turn (F-032 edge). */
  stale?: ScoreStaleReferent | null;
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

  /** 202 with the job; a 409 stale pick is `{stale}` (nothing queued); any other 409 throws (ineligible, a plan
   * already running, a refused REVISE, queue full). `referent` is always sent: null = the whole song. */
  startScorePlan: async (songId: string, request: string, press: ScorePlanPress = {}): Promise<ScorePlanStart> => {
    const res = await post(`/api/songs/${songId}/score/plan`, { request, referent: press.referent ?? null, ...(press.revise ? { revise: press.revise } : {}) });
    if (res.status === 409) {
      const body = (await res.clone().json().catch(() => ({}))) as { error?: string; stale?: ScoreStaleReferent };
      if (body.stale && typeof body.stale === 'object') return { stale: body.stale, error: body.error ?? 'the selection is stale' };
    }
    return json(res);
  },

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
