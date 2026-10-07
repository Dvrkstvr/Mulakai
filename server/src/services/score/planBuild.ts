/**
 * An applied plan -> the pending `Plan` planStore holds (moved out of planJob for C0b): the dock's PLAN
 * and REVISE and the chat's edit turn call the same function, so a chat plan *is* a SCORE plan and
 * APPLY & RENDER treats both alike. The render's cot comes from renderMode (F-065, D-132). Pure: the
 * caller passes the id and the clock.
 */
import { renderMode } from './renderMode.js';
import { editedBars } from './scoreLimits.js';
import type { ApplyResult, Op, Plan, Referent, ScoreFacts, Since } from './planTypes.js';
import type { ScoreSource } from './scoreSource.js';

export interface PlanBuildInput {
  id: string;
  createdAt: number;
  songId: string;
  source: Pick<ScoreSource, 'fingerprint'> & { activeVersionId: string };
  request: string;
  /** The song as read (every op number means it, D-066). */
  facts: ScoreFacts;
  /** The read's chords verdict on the base score. */
  chordsPresent: boolean | null;
  ops: Op[];
  applied: ApplyResult;
  attempts: number;
  refusals: string[][];
  referent?: Referent | null;
  revision?: number;
  since?: Since | null;
}

export function buildPlan(p: PlanBuildInput): Plan {
  const { applied } = p;
  return {
    id: p.id, songId: p.songId, baseVersionId: p.source.activeVersionId, fingerprint: p.source.fingerprint, request: p.request,
    ops: p.ops, verdicts: applied.verdicts, abc: applied.abc, style: applied.style, lyrics: applied.lyrics ?? null,
    checks: { bars: editedBars(applied, p.facts), seconds: applied.seconds, tokens: applied.tokens, chordsPresent: applied.chords_present, changed: applied.changed },
    attempts: p.attempts, refusals: p.refusals, createdAt: p.createdAt,
    referent: p.referent ?? null, revision: p.revision ?? 1, since: p.since ?? null,
    renderMode: renderMode({ chordsPresent: p.chordsPresent, ops: p.ops }), // F-065: the render's cot
  };
}
