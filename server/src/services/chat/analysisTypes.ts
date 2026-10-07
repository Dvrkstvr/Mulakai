/**
 * The C1 server contract (F-052..F-055, docs/decisions/0009, architecture.md "Chat (C1)"): a version's stored
 * analysis (`versions.analysis_json`, `analysis_v: 1`), its bar times, the strip and the player's view, the mark
 * (`RangeMark`, a `range` referent) and how it resolves. Pure. `readAnalysis` reads the raw blob: nothing stored,
 * an unknown `analysis_v` or a broken envelope is "not analyzed" (read again); a broken part alone is not read.
 * `WordsPart` / `ScorePart` are C3's (reading.ts): a transcribed score is context and marking only (Q-062 b).
 */
import type { NotRead, ScorePart, WordsPart } from './reading.js';

export const ANALYSIS_V = 1;
export type { NotRead, ScorePart, WordsPart };

/** WORDS: `stored` (versions.word_timings already holds a reading, D-182), lyrics-server, or skipped. SCORE: the
 * version's own YuE2 sidecar, a SheetSage2 transcription with chords, or skipped. SECTIONS: the cached grid, the
 * score step's transcription grid, a chords run for the grid only, or skipped. */
export interface AnalysisPlanSources {
  words: 'stored' | 'service' | 'skip';
  score: 'own' | 'service' | 'skip';
  sections: 'cached' | 'score' | 'track' | 'skip';
}

/** yue-server `POST /v1/scores/bars`: `starts[i]` is the audio time of score bar i + 1; `end` the song's end.
 * `source`: the grid came from the cache, was tracked for this analysis, or was mapped by a splice. */
export interface BarTimes {
  source: 'cached' | 'tracked' | 'mapped';
  offset: number;
  starts: number[];
  end: number;
  /** Chord-root agreement of the fit (0..1); null when yue-server could not say. */
  agreement: number | null;
}

export interface VersionAnalysis {
  analysis_v: 1;
  versionId: string;
  readAt: string;
  plan: AnalysisPlanSources;
  words: WordsPart | NotRead;
  score: ScorePart | NotRead;
  bars: BarTimes | NotRead;
}
/** The audio could not be read or the GPU guard refused (D-179): stored so FAILED + RETRY survive a reload. */
export interface FailedAnalysis { analysis_v: 1; versionId: string; failed: string; at: string }
export type StoredAnalysis = VersionAnalysis | FailedAnalysis;

export const isFailed = (a: StoredAnalysis): a is FailedAnalysis => 'failed' in a;

/** A version's bars against its base (barShift, D-180): bars at or after `atBar` moved by `delta` (a CUT's
 * negative delta: bars `atBar + delta` .. `atBar - 1` are gone). `shift: null` = moved, by an unknown amount. */
export interface Shift { atBar: number; delta: number }
export type BarShift = { moved: false } | { moved: true; shift: Shift | null };

/** The mark (D-175): bars when the strip had them (1-based, inclusive), seconds always. `label` is the chip's
 * text, frozen in the user message's body (the echo); the server never trusts it. */
export interface RangeMark { kind: 'range'; versionId: string; bars?: [number, number]; seconds: [number, number]; label?: string }
/** `resolveRange` (planReferent): pinned on the playable version (`carried` from a parent whose edit moved no
 * bars, seconds re-timed), or stale, never remapped (409 MARK_STALE; USE BARS only with a known shift). */
export type RangeResolution =
  | { pinned: true; mark: RangeMark; carried: boolean }
  | { pinned: false; was: RangeMark; shift: Shift | null; reason: string };
/** `POST /api/chat/threads/:id/mark/preview` (D-177): WHAT IT SEES's rows and the AS SENT JSON. */
export interface MarkPreview { rows: Array<{ name: string; value: string }>; sent: unknown }

/** One strip section: S<n> of the score as read, the nth of its label, its bars, its seconds (null with no bar
 * times), its lyric lines, and lines that cross its edges (from word timings; 0 for YuE2's own score). */
export interface StripSection {
  index: number;
  label: string;
  occurrence: number;
  bars: [number, number];
  seconds: [number, number] | null;
  lines: number;
  partialLines: number;
}
export type AnalysisStep = 'WORDS' | 'SCORE' | 'SECTIONS';
/** The song's analysis job as the queue sees it (CL-4 fills it from jobRunner). */
export interface LiveAnalysisJob { jobId: string; status: 'queued' | 'running'; ahead: number; progressText: string | null }
export type AnalysisState =
  | { kind: 'none' }
  | { kind: 'queued'; jobId: string; ahead: number }
  | { kind: 'running'; jobId: string; step: AnalysisStep | null; progress: string | null }
  | { kind: 'done' }
  | { kind: 'failed'; reason: string; at: string };
/** The reading the strip shows: the playable version's (`current`), or an older one, `dim` when its bars did not
 * move (clickable) or `hatched` (bars moved, failed, or bars not read: mark by time; `bars` is null). */
export interface ShownReading {
  versionId: string;
  number: number;
  mode: 'current' | 'dim' | 'hatched';
  readAt: string;
  bars: { starts: number[]; end: number } | null;
  sections: StripSection[];
  lines: number;
  /** "TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY". */
  transcribed: boolean;
  notRead: { words: string | null; score: string | null; bars: string | null };
}
/** `GET /api/chat/songs/:songId/analysis`. `lineage`: the playable version against its parent, for markStale. */
export interface AnalysisView {
  songId: string;
  versionId: string | null;
  number: number | null;
  state: AnalysisState;
  shown: ShownReading | null;
  lineage: { fromVersionId: string; moved: boolean; shift: Shift | null } | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullOr = (ok: (x: unknown) => boolean) => (v: unknown) => v === null || ok(v);

const PART_OK: Record<'words' | 'score' | 'bars', (v: Record<string, unknown>) => boolean> = {
  words: (v) => nullOr((x) => typeof x === 'string')(v.language) && isStrings(v.lines) && typeof v.instrumental === 'boolean',
  score: (v) => typeof v.abc === 'string' && (v.source === 'own' || v.source === 'transcribed')
    && nullOr((x) => typeof x === 'boolean')(v.chords) && nullOr(isObject)(v.facts) && isStrings(v.warnings) && nullOr(isObject)(v.measure),
  bars: (v) => ['cached', 'tracked', 'mapped'].includes(v.source as string) && isNum(v.offset) && isNums(v.starts) && isNum(v.end)
    && nullOr(isNum)(v.agreement),
};

function readPart(name: keyof typeof PART_OK, v: unknown): object {
  if (isObject(v) && typeof v.notRead === 'string') return { notRead: v.notRead };
  if (isObject(v) && PART_OK[name](v)) return v;
  return { notRead: `the stored ${name} ${name === 'score' ? 'is' : 'are'} not readable: read again` };
}

const PLAN: Record<keyof AnalysisPlanSources, string[]> = {
  words: ['stored', 'service', 'skip'], score: ['own', 'service', 'skip'], sections: ['cached', 'score', 'track', 'skip'],
};

/** analysis_json → the stored analysis, or null (not analyzed: nothing stored, unknown version, garbage). */
export function readAnalysis(raw: string | null | undefined): StoredAnalysis | null {
  if (!raw) return null;
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(b) || b.analysis_v !== ANALYSIS_V || typeof b.versionId !== 'string') return null;
  if ('failed' in b) {
    return typeof b.failed === 'string' && typeof b.at === 'string'
      ? { analysis_v: ANALYSIS_V, versionId: b.versionId, failed: b.failed, at: b.at } : null;
  }
  const plan = b.plan;
  if (typeof b.readAt !== 'string' || !isObject(plan)
    || !(Object.keys(PLAN) as Array<keyof AnalysisPlanSources>).every((k) => PLAN[k].includes(plan[k] as string))) return null;
  return {
    analysis_v: ANALYSIS_V, versionId: b.versionId, readAt: b.readAt,
    plan: { words: plan.words, score: plan.score, sections: plan.sections } as AnalysisPlanSources,
    words: readPart('words', b.words) as VersionAnalysis['words'],
    score: readPart('score', b.score) as VersionAnalysis['score'],
    bars: readPart('bars', b.bars) as VersionAnalysis['bars'],
  };
}
