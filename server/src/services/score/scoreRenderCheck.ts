/**
 * APPLY & RENDER's re-check (F-023 #3, F-024 #4): the first reason not to start a render, or null.
 * Pure: the caller gathers the facts at click time and again when the queued render's turn comes.
 * Order: eligibility, plan alive (the fingerprint lives on the plan), base version unchanged, no edit
 * queued after the plan (click time only), something to render with, the planner off the GPU.
 * Each refusal names its kind (D-054): `plan` means the plan is out of date (the dock dims it and
 * offers PLAN AGAIN); `gpu` means the plan is fine but the planner may still hold the GPU (a loaded
 * model or an unreadable `/api/ps`), so the dock keeps the plan and shows an error line with RETRY.
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

export interface RenderRefusal {
  reason: string;
  kind: 'plan' | 'gpu';
}

const planRefusal = (reason: string): RenderRefusal => ({ reason, kind: 'plan' });
const gpuRefusal = (reason: string): RenderRefusal => ({ reason, kind: 'gpu' });

export function renderRefusal(f: RenderFacts): RenderRefusal | null {
  const e = f.eligibility;
  if (e.state !== 'eligible') return planRefusal('reason' in e ? e.reason : 'SCORE is not available for this song');
  if (!f.plan || f.plan.songId !== f.songId) return planRefusal(PLAN_EXPIRED);
  const changed = recheckAtCommit(f.plan.fingerprint, f.source);
  if (changed) return planRefusal(changed);
  if (f.pendingEdit) return planRefusal(editQueued(f.pendingEdit));
  if (f.source?.seed === null || f.source?.lyrics === null) return planRefusal(NO_SEED);
  if ('error' in f.loaded) return gpuRefusal(plannerUnconfirmed(f.loaded.error));
  if (f.loaded.length) return gpuRefusal(plannerLoaded(f.loaded.map((m) => m.name)));
  return null;
}
