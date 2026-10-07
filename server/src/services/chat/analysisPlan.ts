/**
 * Where each step of a version analysis comes from (F-052, D-174, D-182, docs/decisions/0009), pure. WORDS:
 * the stored word timings, else lyrics-server; SCORE: the version's own YuE2 sidecar, else a SheetSage2
 * transcription with chords; SECTIONS (bar times from yue-server's `/v1/scores/bars`): the cached grid, else
 * the transcription's grid, else a chords run for the grid alone. A service that is unset skips its step
 * with the reason (C3's `SKIP` wording), which becomes the part's `not read: <why>`, never a failure.
 */
import type { AnalysisPlanSources } from './analysisTypes.js';
import { SKIP, type Services } from './readingPlan.js';

/** What the version already has: a readable own score (scoreSource's sidecar), word timings, a cached grid. */
export interface VersionFacts { ownScore: boolean; wordTimings: boolean; cachedGrid: boolean }

type Skip = { source: 'skip'; why: string };
export interface AnalysisPlan {
  words: { source: 'stored' | 'service' } | Skip;
  score: { source: 'own' | 'service' } | Skip;
  sections: { source: 'cached' | 'score' | 'track' } | Skip;
}

export function analysisPlan(v: VersionFacts, services: Services): AnalysisPlan {
  const words: AnalysisPlan['words'] = v.wordTimings ? { source: 'stored' }
    : services.lyrics ? { source: 'service' } : { source: 'skip', why: SKIP.words };
  const score: AnalysisPlan['score'] = v.ownScore ? { source: 'own' }
    : services.yue ? { source: 'service' } : { source: 'skip', why: SKIP.score };
  // Bar times always need yue-server (the splice's fit); with it up there is always a score to count on.
  const sections: AnalysisPlan['sections'] = !services.yue ? { source: 'skip', why: SKIP.score }
    : v.cachedGrid ? { source: 'cached' } : score.source === 'service' ? { source: 'score' } : { source: 'track' };
  return { words, score, sections };
}

/** What the stored analysis records. */
export const analysisSources = (p: AnalysisPlan): AnalysisPlanSources =>
  ({ words: p.words.source, score: p.score.source, sections: p.sections.source });
