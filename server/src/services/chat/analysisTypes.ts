/**
 * The C1 server contract (F-052..F-055, docs/decisions/0009, architecture.md "Chat (C1)"): a version's stored
 * analysis (`versions.analysis_json`, `analysis_v: 1`), its bar times, the strip and the player's view, the mark
 * (`RangeMark`, a `range` referent) and how it resolves. Pure. `readAnalysis` reads the raw blob: nothing stored,
 * an unknown `analysis_v` or a broken envelope is "not analyzed" (read again); a broken part alone is not read.
 * `WordsPart` / `ScorePart` are C3's (reading.ts): a transcribed score is context and marking only (Q-062 b).
 */
import type { NotRead, ScorePart, WordsPart } from './reading.js';
import type { LyricsPanel } from './convergeTypes.js';
import { readRetime, type ReadingRetime, type RetimeOffer } from './retimeRecord.js';

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

/** yue-server `POST /v1/scores/bars`: `starts[i]` is the audio time of score bar i + 1, strictly increasing, only
 * for the bars the audio holds (Q-120: shorter than the score when it runs past the audio); `end` closes the last.
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
  /** RT-5 (F-092): the score and bars above were re-timed from the kept reading; UNDO restores `previous`. */
  retime?: ReadingRetime;
}
/** The audio could not be read or the GPU guard refused (D-179): stored so FAILED + RETRY survive a reload. */
export interface FailedAnalysis { analysis_v: 1; versionId: string; failed: string; at: string }
export type StoredAnalysis = VersionAnalysis | FailedAnalysis;

export const isFailed = (a: StoredAnalysis): a is FailedAnalysis => 'failed' in a;

const GAP_STEPS = [['words', 'words', 'WORDS'], ['score', 'score', 'SCORE'], ['bars', 'sections', 'SECTIONS']] as const;
/** The first step that ran and read nothing because a service failed (`SCORE · <why>`), or null. A part yue-server
 * answered it cannot read (`answered`: the bar fit refused, no grid) is no gap: reading again gives the same. Such a reading is
 * not done: the line says why with RETRY, and RETRY reads it again (C1 live B1). An unset service (`skip`) is no gap. */
export function readingGap(a: VersionAnalysis): string | null {
  for (const [part, plan, step] of GAP_STEPS) {
    const p = a[part];
    if (a.plan[plan] !== 'skip' && 'notRead' in p && !p.answered) return `${step} · ${p.notRead}`;
  }
  return null;
}
/** Read for good: a done reading with no gap. A failed or gapped one is read again only by RETRY (D-188). */
export const isComplete = (a: StoredAnalysis | null): boolean => a !== null && !isFailed(a) && readingGap(a) === null;

/** A version's bars against its base (barShift, D-180): bars at or after `atBar` moved by `delta` (a CUT's
 * negative delta: bars `atBar + delta` .. `atBar - 1` are gone). `shift: null` = moved, by an unknown amount.
 * `retimed`: the bars were kept but their seconds changed (a SET TEMPO): only the new reading's bar times say
 * where they are now, so no seconds are carried across it (C1 code review should 2). */
export interface Shift { atBar: number; delta: number }
export type BarShift = { moved: false; retimed?: true } | { moved: true; shift: Shift | null };

/** The mark (D-175): bars when the strip had them (1-based, inclusive), seconds always. `label` is the chip's
 * text, frozen in the user message's body (the echo); the server never trusts it. `readAt`: the reading its bars
 * were counted on (RT-5): a re-time renumbers the bars on the same version, so then it is stale. */
export interface RangeMark { kind: 'range'; versionId: string; bars?: [number, number]; seconds: [number, number]; label?: string; readAt?: string }
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
  /** Score bars past the last bar the audio holds, left off the strip (D-197); 0 when the score fits. */
  barsNotShown: number;
  /** Lines in the shown sections, by the strip's own pairing (`readingLines`, C1 live B4). */
  lines: number;
  /** Lines that pair with no shown section ("n LINES OUTSIDE THE SECTIONS" when > 0). */
  linesOutside: number;
  /** "TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY". */
  transcribed: boolean;
  notRead: { words: string | null; score: string | null; bars: string | null };
  /** The lyrics panel (C2, F-056, D-217): computed at read time from this reading and its version's stored text. */
  lyrics: LyricsPanel | null;
  /** RT-5: the READ AS row (HALF · DOUBLE · BPM…) on the playable version's own transcribed reading; else null. */
  retime: RetimeOffer | null;
}
/** A version's `params_json.request.lyrics` and `.style` (`versionLyrics`), what the panel's blocks are split from. */
export interface VersionText { lyrics: string | null; style: string | null }
/** `GET /api/chat/songs/:songId/analysis`. `lineage`: the playable version against its parent, for markStale. */
export interface AnalysisView {
  songId: string;
  versionId: string | null;
  number: number | null;
  state: AnalysisState;
  shown: ShownReading | null;
  /** `retimed`: the bars were kept at a new tempo, so a mark's seconds hold only once this version's bars are read. */
  lineage: { fromVersionId: string; moved: boolean; shift: Shift | null; retimed: boolean } | null;
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
  if (isObject(v) && typeof v.notRead === 'string') return v.answered === true ? { notRead: v.notRead, answered: true } : { notRead: v.notRead };
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
    ...(b.retime !== undefined ? { retime: readRetime(b.retime, readPart) } : {}),
  };
}
