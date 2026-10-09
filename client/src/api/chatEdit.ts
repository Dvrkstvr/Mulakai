/** Chat C0b (CB-5): the edit card's and version card's wire bodies and APPLY. Mirrored by hand from the server's
 * `chat/editTypes.ts` (EditBody), `chat/versionCard.ts` (VersionCardBody) and `routes/chatTurns.ts` (APPLY, C4 RE-RENDER WHOLE SONG); reconcile
 * both when either moves. CANCEL is `chatApi.cancelChatJob`; the job polls through `jobStatus`. */
import type { ScoreOp, ScoreOpVerdict, ScorePlan, ScoreRenderMode, ScoreSince } from './score';
import type { BarMap } from './chatConverge';
import { ApiError, json } from './http';

export type ChatSpliceKind = 'reharmonize' | 'cut' | 'repeat';
/** C4 (F-069, D-266): one span of a chain; `ops` = the plan op indexes it covers (merged REHARMONIZE spans list several). */
export interface ChatSpliceStep { kind: ChatSpliceKind; from_bar: number; to_bar: number; ops: number[] }
/** spliceEligibility's verdict: APPLY splices bars `from_bar`..`to_bar` (the song as read), or renders the whole song.
 * `several` (C4) is a chain of 2-4 spans, `steps` last bar first (the order yue-server splices them); from/to = first and
 * last bar touched. */
export type ChatSplice =
  | { splice: true; kind: ChatSpliceKind; from_bar: number; to_bar: number }
  | { splice: true; kind: 'several'; from_bar: number; to_bar: number; steps: ChatSpliceStep[] }
  | { splice: false; reason: string };
/** The version card's splice: one span, or a chain (`steps` in reading order). */
export type ChatVersionSplice =
  | { kind: ChatSpliceKind; bars: [number, number]; lengthDiffS: number | null }
  | { kind: 'several'; bars: [number, number]; lengthDiffS: number | null; steps: Array<{ kind: ChatSpliceKind; bars: [number, number] }> };

/** An edit card (message kind `edit`): a planStore plan's snapshot. `stale` = APPLY refused, the song changed (STALE). */
export interface ChatEditBody {
  chat_v: 1;
  planId: string;
  ops: ScoreOp[];
  verdicts: ScoreOpVerdict[];
  checks: ScorePlan['checks'];
  splice: ChatSplice;
  renderMode: ScoreRenderMode;
  assumptions: string[];
  attempts: number;
  refusals: string[][];
  stale?: string;
  /** The tempo and key the plan was read at (the dock's "from": 87 → 88 BPM); absent on cards made before it. */
  from?: { bpm: number; key: string };
  /** C1 (F-055): the mark the plan was bounded to (null bars: a time only) and the server's notes on it (a whole-song op,
   * a mark clamped to the score, D-176). Mirrors the server's `EditBody.mark`. */
  mark?: { versionId: string; bars: [number, number] | null; seconds: [number, number]; notes: string[] };
  /** C2 (F-058, D-227): 1 for a first plan, +1 per revise turn; `since` = the marks against the card it revised (NEW /
   * CHANGED / SAME, REMOVED; the score agent's `Since`). Absent on cards from before C2. */
  revision?: number;
  since?: ScoreSince | null;
  /** C2 (F-060, D-215): the bar map built on the server; absent = draw C0b's strip from `splice`. */
  map?: BarMap;
}

/** A saved chat edit (message kind `version`; the message's `versionId` is the version). `previous` is null when there
 * was none or it was deleted in the Editor (no A/B, F-048 edge). */
export interface ChatVersionBody {
  chat_v: 1;
  seconds: number | null;
  label: string;
  number: number;
  truncated: boolean;
  whole: boolean;
  splice: ChatVersionSplice | null;
  /** Why a planned splice was saved as the whole re-render (D-101); null otherwise. */
  fallback: string | null;
  previous: { versionId: string; number: number } | null;
}

/** An edit card's APPLY step while it commits (the message view's `phase`, from the job's progressText). */
export type ChatApplyPhase = 'queued' | 'rendering' | 'splicing' | 'saving';

/** 202 with the job, or the click re-check's reason; `stale` = the song changed since the plan (ASK AGAIN). */
export type ChatApplyStart = { jobId: string } | { refused: string; stale: boolean };

/** 201 with the edit card it appended, or why not (a turn or APPLY runs, not the active spliced version, a limit). */
export type ChatRerenderStart = { messageId: string; proposalId: string } | { refused: string };

export const chatEditApi = {
  applyChatEdit: async (threadId: string, proposalId: string): Promise<ChatApplyStart> => {
    const res = await fetch(`/api/chat/threads/${threadId}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId }),
    });
    if (res.status === 409) {
      const body = (await res.clone().json().catch(() => ({}))) as { reason?: unknown; stale?: unknown };
      if (typeof body.reason === 'string') return { refused: body.reason, stale: body.stale === true };
      throw new ApiError('HTTP 409', 409);
    }
    return json<{ jobId: string }>(res);
  },

  /** RE-RENDER WHOLE SONG (D-268): the server appends a whole-song edit card on the active spliced version; 409 = why not. */
  rerenderWhole: async (threadId: string, versionId: string): Promise<ChatRerenderStart> => {
    const res = await fetch(`/api/chat/threads/${threadId}/versions/${versionId}/rerender`, { method: 'POST' });
    if (res.status === 409 || res.status === 404) {
      const body = (await res.clone().json().catch(() => ({}))) as { reason?: unknown; error?: unknown };
      const reason = body.reason ?? body.error;
      if (typeof reason === 'string') return { refused: reason };
    }
    return json<{ messageId: string; proposalId: string }>(res);
  },
};
