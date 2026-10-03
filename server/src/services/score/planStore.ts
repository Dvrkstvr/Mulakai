/**
 * Pending plans, in server memory only (D-020, D-035): one per song. A successful PLAN replaces
 * the song's plan, a failed one drops it (D-028); a render, a trash or a restart drops it too.
 * Also the song's latest plan run, so the route can answer "what happened to my PLAN" after a
 * reload without the client keeping the job id. Likewise the song's latest render.
 */
import type { Plan, PlanCause } from './planTypes.js';
import type { SavedScoreVersion } from './scoreVersion.js';

export interface PlanRun {
  jobId: string;
  request: string;
  /** Why the run ended without a plan: the last attempt's per-op reasons, or the error. */
  reasons: string[];
  planId: string | null;
  /** Null while it runs or once it made a plan. */
  cause: PlanCause | null;
}

/** APPLY & RENDER's latest job for a song; the job body fills in how it ended. */
export interface RenderRun {
  jobId: string;
  planId: string;
  /** The re-check's reason when the render was refused at its turn (no engine job ran). */
  refused: string | null;
  version: SavedScoreVersion | null;
}

const plans = new Map<string, Plan>();
const runs = new Map<string, PlanRun>();
const renders = new Map<string, RenderRun>();

export function setPlan(plan: Plan): void {
  plans.set(plan.songId, plan);
}

export function getPlan(songId: string): Plan | undefined {
  return plans.get(songId);
}

/** A render names its plan by id; an unknown or replaced id is an expired plan (F-024 #4). */
export function getPlanById(planId: string): Plan | undefined {
  return [...plans.values()].find((p) => p.id === planId);
}

export function dropPlan(songId: string): void {
  plans.delete(songId);
}

export function noteRun(songId: string, run: PlanRun): void {
  runs.set(songId, run);
}

export function lastRun(songId: string): PlanRun | undefined {
  return runs.get(songId);
}

export function noteRender(songId: string, run: RenderRun): void {
  renders.set(songId, run);
}

export function lastRender(songId: string): RenderRun | undefined {
  return renders.get(songId);
}

/** Test hook. */
export function resetPlans(): void {
  plans.clear();
  runs.clear();
  renders.clear();
}
