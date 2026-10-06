/**
 * Where each part of a reading comes from (F-061, D-126, docs/decisions/0008), pure. A library
 * song's own data comes first (a YuE2 song: its own score, words and caption, no GPU); a part it
 * lacks, and every part of an upload, runs on its local service; a service that is unset or not
 * answering skips its step with the reason, which becomes the part's `not read: <why>`.
 */
import type { PartSource, ReadingPlanSources } from './reading.js';
import type { OwnSnapshot } from './referenceStore.js';

export type Part = keyof ReadingPlanSources;
export type PlanStep = { source: 'own' | 'service' } | { source: 'skip'; why: string };
export type ReadingPlan = Record<Part, PlanStep>;
/** lyrics-server and yue-server configured; ACE-Step's health answering (D-135). */
export interface Services { lyrics: boolean; yue: boolean; acestep: boolean }

export const SKIP: Record<Part, string> = {
  words: 'LYRICS_API_URL is not set',
  score: 'YUE_API_URL is not set',
  caption: 'ACE-Step is not running',
};

const has = (v: string | null | undefined) => Boolean(v && v.trim());

export function readingPlan(own: OwnSnapshot | null, services: Services): ReadingPlan {
  const step = (part: Part, owned: boolean, up: boolean): PlanStep =>
    owned ? { source: 'own' } : up ? { source: 'service' } : { source: 'skip', why: SKIP[part] };
  return {
    words: step('words', has(own?.lyrics), services.lyrics),
    score: step('score', has(own?.abc), services.yue),
    caption: step('caption', has(own?.caption), services.acestep),
  };
}

/** What the stored Reading records (and readingEstimate prices). */
export function planSources(plan: ReadingPlan): ReadingPlanSources {
  const s = (p: Part): PartSource => plan[p].source;
  return { words: s('words'), score: s('score'), caption: s('caption') };
}
