/** Chat C1 slice (F-052..F-055): a song's version analysis (the player's reading line, bar ruler and strip), RETRY, and
 * the mark's WHAT IT SEES preview. Mirrored by hand from the server's `chat/analysisTypes.ts` as CL-3 shipped it
 * (`AnalysisView`, `ShownReading`, `StripSection`, `RangeMark`, `MarkPreview`); reconcile both when either moves. The
 * analysis job polls through `jobStatus` like every other job. Bars are 1-based and inclusive; seconds are on the
 * version's timeline. */
import { ApiError, json } from './http';

export type AnalysisStep = 'WORDS' | 'SCORE' | 'SECTIONS';
export const ANALYSIS_STEPS: readonly AnalysisStep[] = ['WORDS', 'SCORE', 'SECTIONS'];

/** The playable version's analysis job: none yet, queued (`ahead` jobs before it), running (`step` null until the
 * progress names one; `progress` = the job's text), done, or failed (stored, so FAILED + RETRY survive a reload, D-179). */
export type AnalysisState =
  | { kind: 'none' }
  | { kind: 'queued'; jobId: string; ahead: number }
  | { kind: 'running'; jobId: string; step: AnalysisStep | null; progress: string | null }
  | { kind: 'done' }
  | { kind: 'failed'; reason: string; at: string };

/** One strip section: S<n> of the score as read (`index`), the nth of its label, its bars, its seconds (null with no
 * bar times), its lyric lines, and lines that cross its edges. */
export interface StripSection {
  index: number;
  label: string;
  occurrence: number;
  bars: [number, number];
  seconds: [number, number] | null;
  lines: number;
  partialLines: number;
}

/** Bar start times: `starts[i]` is bar i+1's start; `end` closes the last bar. */
export interface ShownBars { starts: number[]; end: number }

/** The reading the strip shows: the playable version's (`current`), or an older one: `dim` (its edit moved no bars,
 * still marks) or `hatched` (bars moved, failed, or bars not read: mark by time, `bars` null, F-053 #2). */
export interface ShownReading {
  versionId: string;
  number: number;
  mode: 'current' | 'dim' | 'hatched';
  readAt: string;
  bars: ShownBars | null;
  sections: StripSection[];
  /** Score bars past the last bar the audio holds; the server leaves them off `sections` (D-197). 0 when it fits. */
  barsNotShown: number;
  /** Lines in the shown sections, by the strip's own pairing (C1 live B4): the line and the strip agree. */
  lines: number;
  /** Lines that pair with no shown section; the line names them when > 0. */
  linesOutside: number;
  /** A transcribed score (not YuE2's own): context and marking only, SCORE stays off (Q-062 b). */
  transcribed: boolean;
  /** Each part's "not read" reason, null when read (`words` set = no word timings, F-052 #4). */
  notRead: { words: string | null; score: string | null; bars: string | null };
}

/** `barShift` of a version against its base (D-180): bars at or after `atBar` moved by `delta` (a CUT's negative
 * delta: bars `atBar + delta` .. `atBar - 1` are gone). Reported only by CUT / REPEAT. */
export interface Shift { atBar: number; delta: number }

/** GET /api/chat/songs/:songId/analysis. `versionId` / `number`: the playable version (D-120), null when the song has
 * none; `lineage`: it against its parent, one step, for `markStale`. */
export interface AnalysisView {
  songId: string;
  versionId: string | null;
  number: number | null;
  state: AnalysisState;
  shown: ShownReading | null;
  /** `retimed`: the edit kept the bars at a new tempo (SET TEMPO): a mark's seconds hold only once this version's own
   * bars are read, and a time-only mark never carries (C1 code review should 2). */
  lineage: { fromVersionId: string; moved: boolean; shift: Shift | null; retimed?: boolean } | null;
}

/** The mark (a `planReferent` kind, D-175): no `bars` = a seconds-only mark (no reading of the bars, D-179). `label`:
 * the chip's text, frozen in the user message's body (the echo); the server never trusts it. */
export interface RangeMark { kind: 'range'; versionId: string; bars?: [number, number]; seconds: [number, number]; label?: string }

/** 409 `MARK_STALE` at SEND or on the preview: the old place, the shift when known; nothing was written. */
export interface MarkStaleBody { error: 'MARK_STALE'; reason: string; was: RangeMark; shift: Shift | null }
export class MarkStaleError extends ApiError {
  was: RangeMark;
  shift: Shift | null;
  constructor(body: MarkStaleBody) {
    super(body.reason || 'MARK_STALE', 409);
    this.was = body.was;
    this.shift = body.shift ?? null;
  }
}
export const isMarkStaleBody = (b: unknown): b is MarkStaleBody =>
  !!b && typeof b === 'object' && (b as { error?: unknown }).error === 'MARK_STALE' && !!(b as { was?: unknown }).was;
/** A 409 body: a MARK_STALE error, else an ApiError with the server's reason (null when it has none). */
export function conflictError(body: Record<string, unknown>): ApiError | null {
  if (isMarkStaleBody(body)) return new MarkStaleError(body);
  return typeof body.reason === 'string' ? new ApiError(body.reason, 409) : null;
}

/** WHAT IT SEES: plain rows and AS SENT (the JSON the turn sends), from the server's `markBlock` (D-177). */
export interface MarkPreview { rows: Array<{ name: string; value: string }>; sent: unknown }

const post = (url: string, body?: unknown) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const conflictBody = async (res: Response) => (await res.clone().json().catch(() => ({}))) as Record<string, unknown>;

export const chatAnalysisApi = {
  analysisView: (songId: string) => fetch(`/api/chat/songs/${songId}/analysis`).then((r) => json<AnalysisView>(r)),

  /** RETRY on a failed reading: 202 `{jobId}`, or 409 `{reason}`. */
  retryAnalysis: async (songId: string): Promise<{ jobId: string } | { refused: string }> => {
    const res = await post(`/api/chat/songs/${songId}/analysis/retry`);
    if (res.status === 409) {
      const reason = (await conflictBody(res)).reason;
      if (typeof reason === 'string') return { refused: reason };
    }
    return json<{ jobId: string }>(res);
  },

  /** Fetched when WHAT IT SEES opens; a stale mark throws `MarkStaleError`. */
  markPreview: async (threadId: string, mark: RangeMark): Promise<MarkPreview> => {
    const res = await post(`/api/chat/threads/${threadId}/mark/preview`, { mark });
    if (res.status === 409) {
      const err = conflictError(await conflictBody(res));
      if (err) throw err;
    }
    return json<MarkPreview>(res);
  },
};
