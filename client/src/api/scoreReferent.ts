/** "This one" and REVISE on the wire (F-032, F-033): mirrors server/src/services/score/planTypes.ts
 * (ReferentInput, Referent, StaleReferent, Since), re-exported from routes/scorePlan.ts. */
import type { ScoreOp } from './score';

/** A section of the score as read: `index` is the bar map's S<n>, `label` its `% label` ("chorus"), `occurrence`
 * its count among sections of that label (sent by GET /score). */
export interface ScoreSection { index: number; label: string; occurrence?: number; from_bar: number; to_bar: number }

/** A lyric block as yue-server numbers it (blank-line blocks, 1..N; occurrence among blocks of its kind). */
export interface ScoreLyricBlock { index: number; tag: string; occurrence: number; lines: number; first_line: string }

/** A pick sent with PLAN / REVISE: a strip section, or a lyric line (`line` is 1-based within its block).
 * `of`: how many of that label / kind the song had at the pick (always sent). */
export type ScoreReferentInput =
  | { kind: 'section'; section: number; label: string; occurrence: number; of?: number; bars: [number, number] }
  | { kind: 'line'; block: number; tag: string; occurrence: number; of?: number; line: number; text?: string | null };

/** A pick as the server pinned it (renumbered); a line also names the section that sings its block, if any.
 * It is a valid ScoreReferentInput, so USE BARS and REVISE send it back as it is. */
export type ScoreReferent =
  | { kind: 'section'; section: number; label: string; occurrence: number; of: number; bars: [number, number] }
  | { kind: 'line'; block: number; tag: string; occurrence: number; of: number; line: number; text: string | null;
      section: number | null; label: string | null; bars: [number, number] | null };

/** A pick that no longer matches the score: `now` is where that label + occurrence lives now (USE BARS),
 * null when it is gone. Nothing was planned against it. */
export interface ScoreStaleReferent { picked: ScoreReferentInput; now: ScoreReferent | null; reason: string }

export type ScoreOpMark = 'NEW' | 'CHANGED' | 'SAME';

/** A REVISE's ops against the plan it replaced: one mark per op, in order, and the ops it dropped. */
export interface ScoreSince { planId: string; marks: Array<{ mark: ScoreOpMark; was: ScoreOp | null }>; removed: ScoreOp[] }

/** What one press sends besides the request: the pick ("this"), and the plan a REVISE changes. */
export interface ScorePlanPress { referent?: ScoreReferentInput | null; revise?: string | null }

/** POST plan: 202 with the job, or a 409 stale pick (nothing was queued). */
export type ScorePlanStart = { jobId: string; queuePosition: number } | { stale: ScoreStaleReferent; error: string };
