/**
 * SCORE's eligibility for one song, end to end: scoreSource (DB + sidecar) → yue-server's
 * read verdict, asked only when the DB alone cannot decide → scoreEligibility. The planner
 * probe (offline / not Ollama) is layered on by the route, not here.
 */
import { config } from '../../config.js';
import { loadScoreSource, type ScoreSource } from './scoreSource.js';
import { readScore, type ScoreRead } from './yueScoreRead.js';
import { decideBeforeRead, decideEligibility, recheckAtCommit, type Eligibility, type ReadOutcome } from './scoreEligibility.js';

export interface ScoreStatusDeps {
  read?: (abc: string, lyrics: string | null) => Promise<ScoreRead>;
  plannerConfigured?: boolean;
  yueConfigured?: boolean;
}

export interface ScoreStatus {
  eligibility: Eligibility;
  /** Null for a missing or trashed song. Its `fingerprint` is what a plan records. */
  source: ScoreSource | null;
  /** The verdict and planner facts; null when yue-server was not (or could not be) asked. */
  read: ScoreRead | null;
}

export async function scoreStatus(songId: string, deps: ScoreStatusDeps = {}): Promise<ScoreStatus> {
  const plannerConfigured = deps.plannerConfigured ?? Boolean(process.env.LLM_API_URL?.trim());
  const yueConfigured = deps.yueConfigured ?? Boolean(config.yueUrl.trim());
  const read = deps.read ?? ((abc: string, lyrics: string | null) => readScore(abc, lyrics));
  const source = await loadScoreSource(songId);
  const early = decideBeforeRead({ plannerConfigured, yueConfigured, source });
  if (early || !source?.abc) return { eligibility: early ?? { state: 'hidden' }, source, read: null };
  let outcome: Exclude<ReadOutcome, null>;
  try {
    outcome = await read(source.abc, source.lyrics);
  } catch (err) {
    outcome = { unreachable: err instanceof Error ? err.message : String(err) };
  }
  return {
    eligibility: decideEligibility({ plannerConfigured, yueConfigured, source, read: outcome }),
    source,
    read: 'unreachable' in outcome ? null : outcome,
  };
}

/** APPLY & RENDER's re-check against the plan's fingerprint: DB only, never calls yue-server. */
export async function recheckForRender(songId: string, planFingerprint: string): Promise<string | null> {
  return recheckAtCommit(planFingerprint, await loadScoreSource(songId));
}
