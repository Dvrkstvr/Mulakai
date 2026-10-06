/**
 * A reference's reading (F-061, docs/decisions/0008), pure: the stored `Reading` (`reading_v: 1`)
 * read from the raw blob, the facts a recipe borrows from it (D-135: ACE-Step's tempo / key / meter,
 * else the score header; structure from the score's sections), and whether it can be covered.
 * A part that was not read is `{notRead: <why>}` (the card prefixes "not read: "), never empty.
 */
import { parseKey } from '../engines/abcMeta.js';
import type { ScoreSize } from '../engineTranscribeClient.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { BPM, KEYS, TIME_SIGNATURES } from './recipeRules.js';

export const READING_V = 1;

export interface NotRead { notRead: string }
/** Where a step ran: the library song's own data, a local service, or skipped (`notRead` says why). */
export type PartSource = 'own' | 'service' | 'skip';
export interface ReadingPlanSources { words: PartSource; score: PartSource; caption: PartSource }
export interface WordsPart { language: string | null; lines: string[]; instrumental: boolean }
export interface ScorePart {
  abc: string;
  source: 'own' | 'transcribed';
  /** Chord symbols present (D-131); null when unknown. */
  chords: boolean | null;
  /** yue-server `/v1/scores/read` facts; null when the score does not parse. */
  facts: ScoreFacts | null;
  warnings: string[];
  /** `/v1/scores/measure`; null when the backend cannot say. */
  measure: ScoreSize | null;
}
export interface CaptionPart { caption: string; bpm: number | null; key: string | null; meter: string | null }

export interface Reading {
  reading_v: 1;
  readAt: string;
  /** The whole file's length; `readTo` what was read (≤ 360 s, `cut` when shorter than the file). */
  seconds: number | null;
  readTo: number;
  cut: boolean;
  plan: ReadingPlanSources;
  words: WordsPart | NotRead;
  score: ScorePart | NotRead;
  caption: CaptionPart | NotRead;
}

export const isRead = <T extends object>(part: T | NotRead): part is T => !('notRead' in part);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const numOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const strOrNull = (v: unknown) => v === null || typeof v === 'string';
const SOURCES = new Set(['own', 'service', 'skip']);

const PART_OK: Record<'words' | 'score' | 'caption', (v: Record<string, unknown>) => boolean> = {
  words: (v) => strOrNull(v.language) && isStrings(v.lines) && typeof v.instrumental === 'boolean',
  score: (v) => typeof v.abc === 'string' && (v.source === 'own' || v.source === 'transcribed')
    && (v.chords === null || typeof v.chords === 'boolean') && (v.facts === null || isObject(v.facts))
    && isStrings(v.warnings) && (v.measure === null || isObject(v.measure)),
  caption: (v) => typeof v.caption === 'string' && numOrNull(v.bpm) && strOrNull(v.key) && strOrNull(v.meter),
};

function readPart(name: keyof typeof PART_OK, v: unknown): object {
  if (isObject(v) && typeof v.notRead === 'string') return { notRead: v.notRead };
  if (isObject(v) && PART_OK[name](v)) return v;
  return { notRead: `the stored ${name} ${name === 'words' ? 'are' : 'is'} not readable: read again` };
}

const AGAIN = 'the stored reading is not readable by this version: read again';

/** reading_json → Reading. Nothing stored: `{null, null}` (not read yet); unreadable JSON, an
 * unknown `reading_v` or a broken envelope: `{null, note}`; a broken part alone reads as not read. */
export function readReading(raw: string | null | undefined): { reading: Reading | null; note: string | null } {
  if (!raw) return { reading: null, note: null };
  let blob: unknown;
  try {
    blob = JSON.parse(raw);
  } catch {
    return { reading: null, note: AGAIN };
  }
  if (!isObject(blob) || blob.reading_v !== READING_V || typeof blob.readAt !== 'string' || !numOrNull(blob.seconds)
    || typeof blob.readTo !== 'number' || typeof blob.cut !== 'boolean' || !isObject(blob.plan)
    || !(['words', 'score', 'caption'] as const).every((k) => SOURCES.has((blob as { plan: Record<string, unknown> }).plan[k] as string))) {
    return { reading: null, note: AGAIN };
  }
  const plan = blob.plan as unknown as ReadingPlanSources;
  return {
    reading: {
      reading_v: READING_V, readAt: blob.readAt, seconds: blob.seconds as number | null, readTo: blob.readTo, cut: blob.cut,
      plan: { words: plan.words, score: plan.score, caption: plan.caption },
      words: readPart('words', blob.words) as Reading['words'],
      score: readPart('score', blob.score) as Reading['score'],
      caption: readPart('caption', blob.caption) as Reading['caption'],
    },
    note: null,
  };
}

export type FactField = 'bpm' | 'key' | 'meter' | 'structure';
export interface ReadingFacts {
  bpm: number | null;
  /** One of the 30 draft key names (`Am`, `F#`). */
  key: string | null;
  meter: string | null;
  /** The score's section labels in order, as written (`verse`); referenceRecipe maps them to tags. */
  structure: string[];
  /** The caption's words, for the model's STYLE; null when not read. */
  instrumentation: string | null;
  /** null when the words were not read. */
  instrumental: boolean | null;
  sources: Record<FactField, 'caption' | 'score' | null>;
  missing: FactField[];
}

/** `A minor` / `Am` / `F#min` → `Am` / `F#m`; null outside the 30 draft keys (modes included). */
function draftKey(raw: string | null): string | null {
  const [tonic, mode] = parseKey(raw ?? '').split(' ');
  const key = mode === 'minor' ? `${tonic}m` : mode === 'major' ? tonic : '';
  return KEYS.includes(key) ? key : null;
}
const draftBpm = (v: number | null) => (v !== null && v >= BPM.min && v <= BPM.max ? Math.round(v) : null);
const draftMeter = (v: string | null) => (v && TIME_SIGNATURES.includes(v.replace(/\s+/g, '')) ? v.replace(/\s+/g, '') : null);

/** What a recipe may borrow. `prefer: 'score'` (a cover sings the score's own) skips the caption's
 * tempo, key and meter. A value neither source gives in the draft's terms is missing, never guessed. */
export function readingFacts(reading: Reading, prefer: 'caption' | 'score' = 'caption'): ReadingFacts {
  const caption = isRead(reading.caption) ? reading.caption : null;
  const header = isRead(reading.score) ? reading.score.facts?.header ?? null : null;
  const sections = isRead(reading.score) ? reading.score.facts?.sections ?? [] : [];
  const sources: ReadingFacts['sources'] = { bpm: null, key: null, meter: null, structure: sections.length ? 'score' : null };
  const pick = <T>(field: FactField, fromCaption: T | null, fromScore: T | null): T | null => {
    const first = prefer === 'caption' ? fromCaption : null;
    sources[field] = first !== null ? 'caption' : fromScore !== null ? 'score' : null;
    return first ?? fromScore;
  };
  const bpm = pick('bpm', draftBpm(caption?.bpm ?? null), draftBpm(header?.bpm ?? null));
  const key = pick('key', draftKey(caption?.key ?? null), draftKey(header?.key ?? null));
  const meter = pick('meter', draftMeter(caption?.meter ?? null), draftMeter(header?.meter ?? null));
  const facts = { bpm, key, meter, structure: sections.map((s) => s.label) };
  return {
    ...facts,
    instrumentation: caption?.caption || null,
    instrumental: isRead(reading.words) ? reading.words.instrumental : null,
    sources,
    missing: (['bpm', 'key', 'meter', 'structure'] as const).filter((f) => sources[f] === null),
  };
}

export type CoverVerdict = { ok: true } | { ok: false; reason: string };

/** A cover sings the reading's score on YuE2: it must be read, parse, and fit the planner budget
 * whole (no section picking in C3, Q-096). No measure: GENERATE's own check is the backstop. */
export function coverVerdict(reading: Reading): CoverVerdict {
  if (!isRead(reading.score)) return { ok: false, reason: `the score was not read: ${reading.score.notRead}` };
  if (!reading.score.facts) return { ok: false, reason: 'the score does not parse, so YuE2 cannot sing it' };
  const m = reading.score.measure;
  if (!m) return { ok: true };
  const tokens = m.header + m.sections.reduce((n, s) => n + s.tokens, 0);
  if (tokens > m.budget) {
    return { ok: false, reason: `the score is ${tokens.toLocaleString('en-US')} of ${m.budget.toLocaleString('en-US')} tokens, too long for YuE2 to cover` };
  }
  return { ok: true };
}
