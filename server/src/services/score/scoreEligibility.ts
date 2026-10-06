/**
 * Can this song be score-edited, and if not, why (F-018; D-006, D-021, D-043). Pure: the
 * caller gathers the facts (scoreSource + yue-server's read verdict). Songs SCORE does not
 * apply to at all (ACE-Step, import, HeartMuLa, feature not set up) are `hidden`; a YuE2
 * song that fails a rule is `ineligible` with one reason line.
 */
import type { ScoreSource } from './scoreSource.js';
import type { ScoreRead } from './yueScoreRead.js';

export type Eligibility =
  | { state: 'hidden' }
  | { state: 'ineligible'; reason: string }
  /** The score could not be checked (yue-server down): nothing is wrong with the song. */
  | { state: 'offline'; reason: string }
  | { state: 'eligible' };

/** `read` is null until yue-server has been asked; `unreachable` when asking failed. */
export type ReadOutcome = ScoreRead | { unreachable: string } | null;

export interface EligibilityFacts {
  /** LLM_API_URL set. */
  plannerConfigured: boolean;
  /** YUE_API_URL set. */
  yueConfigured: boolean;
  source: ScoreSource | null;
  read: ReadOutcome;
}

export const CHANGED_SINCE_PLAN = 'this song changed since the plan';

const ineligible = (reason: string): Eligibility => ({ state: 'ineligible', reason });

/** A tags-only lyric sheet (`INSTRUMENTAL_LYRICS` or the user's own blank sections). */
function isInstrumental(lyrics: string | null): boolean {
  if (lyrics === null) return false;
  return lyrics.split('\n').every((line) => !line.trim() || /^\s*\[[^\]]*\]\s*$/.test(line));
}

/** Everything decidable from the DB alone; null = only the sidecar's verdict is left. */
export function decideBeforeRead(facts: Omit<EligibilityFacts, 'read'>): Eligibility | null {
  const s = facts.source;
  if (!facts.plannerConfigured || !facts.yueConfigured || !s || s.engine !== 'yue2') return { state: 'hidden' };
  if (s.layerCount > 1) return ineligible(`This song has ${s.layerCount} layers; a re-render would drop the extra one.`);
  if (s.baseVersions.some((v) => v.engine !== 'yue2')) {
    return ineligible('This song has a repaint version, so score editing ended when it was made.');
  }
  if (s.genTask === 'cover') return ineligible('This song is a cover of another score; not supported yet.');
  if (s.genTask !== 'text2music') return { state: 'hidden' };
  if (isInstrumental(s.lyrics)) return ineligible('This song is instrumental; not supported yet.');
  if (s.abc === null) return ineligible('This song has no saved score.');
  return null;
}

export function decideEligibility(facts: EligibilityFacts): Eligibility {
  const early = decideBeforeRead(facts);
  if (early) return early;
  const r = facts.read;
  if (!r) return { state: 'offline', reason: 'The saved score has not been checked yet. RECHECK.' };
  if ('unreachable' in r) return { state: 'offline', reason: `Score checker unreachable: ${r.unreachable}. Start yue-server, then RECHECK.` };
  if (!r.ok) return ineligible(`The saved score fails the checker: ${r.messages[0] ?? r.error ?? 'unknown error'}.`);
  if (r.chordsPresent !== true) return ineligible('This score has no chords; not supported yet.');
  return { state: 'eligible' };
}

/** The commit-time re-check: any layer or version change since the plan refuses the render. */
export function recheckAtCommit(planFingerprint: string, now: ScoreSource | null): string | null {
  return now && now.fingerprint === planFingerprint ? null : CHANGED_SINCE_PLAN;
}
