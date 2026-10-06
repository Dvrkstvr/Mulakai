/**
 * The three steps of a reading (F-061, docs/decisions/0008) over injected clients: WORDS
 * (lyrics-server, or the library song's own words), SCORE (the own ABC, or a yue-server
 * transcription with chords, D-131; then `/v1/scores/read` and `/v1/scores/measure`), CAPTION
 * (ACE-Step ANALYZE AUDIO, or the own caption). Each step returns its part or `{notRead: <why>}`;
 * a step never throws. The job's progress text starts with the step's name (the client's contract).
 */
import type { FormatInputResult } from '../acestep.js';
import type { ScoreSize } from '../engineTranscribeClient.js';
import type { LyricsReading } from '../lyricsClient.js';
import type { ScoreRead } from '../score/yueScoreRead.js';
import type { TranscriptionOutcome } from '../transcribeJobs.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { detectLanguage } from './lyricLanguage.js';
import type { CaptionPart, NotRead, ScorePart, WordsPart } from './reading.js';
import type { Part, PlanStep } from './readingPlan.js';
import type { OwnSnapshot } from './referenceStore.js';

export const STEP_NAME: Record<Part, string> = { words: 'WORDS', score: 'SCORE', caption: 'CAPTION' };
/** `WORDS`, or `SCORE · transcribing 41%`: the step's name first, always. */
export const stepText = (part: Part, note?: string): string => (note ? `${STEP_NAME[part]} · ${note}` : STEP_NAME[part]);

export interface StepDeps {
  lyrics: (audio: Buffer, filename: string, signal: AbortSignal) => Promise<LyricsReading>;
  /** Undefined once the job was aborted (the engine stopped). `onProgress`: 0..1. */
  transcribe: (audio: Buffer, filename: string, onProgress: (p: number | undefined) => void) => Promise<TranscriptionOutcome | undefined>;
  readScore: (abc: string, lyrics: string | null) => Promise<ScoreRead>;
  measure: (abc: string) => Promise<ScoreSize | null>;
  analyze: (file: { data: Buffer; filename: string }) => Promise<FormatInputResult>;
}

export interface StepInput {
  audio: Buffer;
  filename: string;
  own: OwnSnapshot | null;
  step: PlanStep;
  signal: AbortSignal;
  /** The note after the step's name, for the job's progress text. */
  progress: (note?: string) => void;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
const TAG = /^\s*\[[^\]]*\]\s*$/;

async function words(input: StepInput, deps: StepDeps): Promise<WordsPart | NotRead> {
  let lines: string[];
  let language: string | null = null;
  if (input.step.source === 'own') {
    lines = (input.own?.lyrics ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !TAG.test(l));
  } else {
    input.progress('lyrics-server');
    const heard = await deps.lyrics(input.audio, input.filename, input.signal);
    lines = heard.segments.map((s) => s.text.trim()).filter(Boolean);
    language = heard.language || null;
  }
  if (!language && lines.length) language = await detectLanguage(lines.join('\n')).catch(() => null);
  return { language, lines, instrumental: lines.length === 0 };
}

async function score(input: StepInput, deps: StepDeps): Promise<ScorePart | NotRead> {
  let abc: string;
  const warnings: string[] = [];
  if (input.step.source === 'own') {
    abc = input.own?.abc ?? '';
  } else {
    input.progress('transcribing');
    const out = await deps.transcribe(input.audio, input.filename,
      (p) => input.progress(p === undefined ? 'transcribing' : `transcribing ${Math.round(p * 100)}%`));
    if (!out) return { notRead: 'cancelled' };
    abc = out.score;
    warnings.push(...out.warnings);
  }
  input.progress('checking the score');
  let facts: ScoreFacts | null = null;
  let chords: boolean | null = null;
  try {
    const read = await deps.readScore(abc, input.step.source === 'own' ? input.own?.lyrics ?? null : null);
    facts = read.ok ? read.facts : null;
    chords = read.chordsPresent;
    if (!read.ok) warnings.push(read.error ?? 'the score does not parse');
    warnings.push(...read.messages);
  } catch (err) {
    warnings.push(`the score was not checked: ${why(err)}`);
  }
  let measure: ScoreSize | null = null;
  try {
    measure = await deps.measure(abc);
  } catch (err) {
    warnings.push(`the score was not measured: ${why(err)}`);
  }
  return { abc, source: input.step.source === 'own' ? 'own' : 'transcribed', chords, facts, warnings, measure };
}

async function caption(input: StepInput, deps: StepDeps): Promise<CaptionPart | NotRead> {
  const own = input.own;
  if (input.step.source === 'own' && own) return { caption: own.caption ?? '', bpm: own.bpm, key: own.key, meter: own.meter };
  input.progress('ACE-Step');
  const a = await deps.analyze({ data: input.audio, filename: input.filename });
  if (!a.caption?.trim() && !a.bpm && !a.key_scale) return { notRead: 'ACE-Step described nothing' };
  return { caption: a.caption ?? '', bpm: a.bpm ?? null, key: a.key_scale || null, meter: a.time_signature || null };
}

const RUN = { words, score, caption };

/** One step: its part, or `{notRead}` (skipped, or its service failed). Never throws. */
export async function runStep<P extends Part>(part: P, input: StepInput, deps: StepDeps):
  Promise<Awaited<ReturnType<(typeof RUN)[P]>>> {
  input.progress();
  if (input.step.source === 'skip') return { notRead: input.step.why } as Awaited<ReturnType<(typeof RUN)[P]>>;
  try {
    return await (RUN[part] as (i: StepInput, d: StepDeps) => ReturnType<(typeof RUN)[P]>)(input, deps);
  } catch (err) {
    return { notRead: why(err) } as Awaited<ReturnType<(typeof RUN)[P]>>;
  }
}
