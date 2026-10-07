/** Chat C0b (CB-5): the edit card's and version card's wire bodies and APPLY. Mirrored by hand from the server's
 * `chat/editTypes.ts` (EditBody), `chat/versionCard.ts` (VersionCardBody) and `routes/chatTurns.ts` (APPLY); reconcile
 * both when either moves. CANCEL is `chatApi.cancelChatJob`; the job polls through `jobStatus`. */
import type { ScoreOp, ScoreOpVerdict, ScorePlan, ScoreRenderMode } from './score';
import { ApiError, json } from './http';

export type ChatSpliceKind = 'reharmonize' | 'cut' | 'repeat';
/** spliceEligibility's verdict: APPLY splices bars `from_bar`..`to_bar` (the song as read), or renders the whole song. */
export type ChatSplice = { splice: true; kind: ChatSpliceKind; from_bar: number; to_bar: number } | { splice: false; reason: string };

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
  splice: { kind: ChatSpliceKind; bars: [number, number]; lengthDiffS: number | null } | null;
  /** Why a planned splice was saved as the whole re-render (D-101); null otherwise. */
  fallback: string | null;
  previous: { versionId: string; number: number } | null;
}

/** An edit card's APPLY step while it commits (the message view's `phase`, from the job's progressText). */
export type ChatApplyPhase = 'queued' | 'rendering' | 'splicing' | 'saving';

/** 202 with the job, or the click re-check's reason; `stale` = the song changed since the plan (ASK AGAIN). */
export type ChatApplyStart = { jobId: string } | { refused: string; stale: boolean };

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
};
