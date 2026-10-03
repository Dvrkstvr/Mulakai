/**
 * APPLY & RENDER's re-check (F-023 #3, F-024 #4): the first reason not to start a render, or null.
 * Pure: the caller gathers the facts at click time and again when the queued render's turn comes.
 * Order: eligibility, plan alive (the fingerprint lives on the plan), base version unchanged, no edit
 * queued after the plan (click time only), something to render with, the planner off the GPU.
 */
import type { LoadedModel } from './ollamaControl.js';
import type { Plan } from './planTypes.js';
import { recheckAtCommit, type Eligibility } from './scoreEligibility.js';
import { NO_SEED, PLAN_EXPIRED, editQueued, plannerLoaded, plannerUnconfirmed } from './scoreLimits.js';
import type { ScoreSource } from './scoreSource.js';

export interface RenderFacts {
  songId: string;
  eligibility: Eligibility;
  /** planStore's plan for the id the client sent; undefined once replaced or lost. */
  plan: Plan | undefined;
  source: ScoreSource | null;
  /** What an edit queued or running on this song is doing ("repaint 1:32–2:07"), else null. */
  pendingEdit: string | null;
  /** `/api/ps` now, or why it could not be read. */
  loaded: LoadedModel[] | { error: string };
}

export function renderRefusal(f: RenderFacts): string | null {
  const e = f.eligibility;
  if (e.state !== 'eligible') return 'reason' in e ? e.reason : 'SCORE is not available for this song';
  if (!f.plan || f.plan.songId !== f.songId) return PLAN_EXPIRED;
  const changed = recheckAtCommit(f.plan.fingerprint, f.source);
  if (changed) return changed;
  if (f.pendingEdit) return editQueued(f.pendingEdit);
  if (f.source?.seed === null || f.source?.lyrics === null) return NO_SEED;
  if ('error' in f.loaded) return plannerUnconfirmed(f.loaded.error);
  if (f.loaded.length) return plannerLoaded(f.loaded.map((m) => m.name));
  return null;
}
