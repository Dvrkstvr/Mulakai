/**
 * The three steps of a version analysis (F-052, D-171, D-174, docs/decisions/0009) over injected clients. WORDS
 * and SCORE are C3's `readingSteps.runStep` reused: WORDS reads the stored word timings, or lyrics-server (whose
 * raw reading is kept for `versions.word_timings`); SCORE reads the version's own YuE2 sidecar, or a SheetSage2
 * transcription with chords. SECTIONS gets a downbeat grid (the cached sidecar; the score step's transcription
 * grid; or a chords run for the grid alone, written to the cache for the next splice) and asks yue-server for
 * the bar start times. Each step returns its part or `{notRead: <why>}` and never throws; `check` (the job's
 * cancel check) runs between steps and is the only thing that throws. Progress text starts with the step name.
 */
import type { LyricsReading } from '../lyricsClient.js';
import type { BarsResult } from '../score/yueScoreBars.js';
import type { TranscriptionOutcome } from '../transcribeJobs.js';
import type { AnalysisPlan } from './analysisPlan.js';
import type { BarTimes } from './analysisTypes.js';
import type { Grid } from './gridCache.js';
import { isRead, type NotRead, type ScorePart, type WordsPart } from './reading.js';
import type { PlanStep } from './readingPlan.js';
import type { OwnSnapshot } from './referenceStore.js';
import { runStep, stepText, type StepDeps } from './readingSteps.js';

export interface AnalysisStepDeps extends Pick<StepDeps, 'lyrics' | 'transcribe' | 'readScore' | 'measure'> {
  /** A chords run's grid by yue-server's job id; null when it kept none. */
  grid: (yueJobId: string) => Promise<Record<string, unknown> | null>;
  bars: (abc: string, grid: unknown, source: BarTimes['source']) => Promise<BarsResult>;
  readGrid: (versionId: string) => Promise<Grid | null>;
  writeGrid: (versionId: string, grid: unknown) => Promise<boolean>;
}

export interface AnalysisInput {
  versionId: string;
  audio: Buffer;
  filename: string;
  /** The version's own YuE2 score and its lyrics (SCORE `own`). */
  own: { abc: string; lyrics: string | null } | null;
  /** `versions.word_timings` (WORDS `stored`). */
  storedWords: LyricsReading | null;
  plan: AnalysisPlan;
  signal: AbortSignal;
  /** The job's whole progress text. */
  progress: (text: string) => void;
}

export interface AnalysisParts {
  words: WordsPart | NotRead;
  score: ScorePart | NotRead;
  bars: BarTimes | NotRead;
  /** lyrics-server's reading when WORDS asked it (for `versions.word_timings`). */
  timings: LyricsReading | null;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
const sections = (note?: string) => (note ? `SECTIONS · ${note}` : 'SECTIONS');
const pct = (p: number | undefined) => (p === undefined ? '' : ` ${Math.round(p * 100)}%`);

/** The step input runStep takes; the analysis has no caption, so `analyze` is never called. */
function stepDeps(deps: AnalysisStepDeps, over: Partial<StepDeps>): StepDeps {
  return { ...deps, analyze: async () => { throw new Error('no caption in a version analysis'); }, ...over };
}

function storedWords(w: LyricsReading): WordsPart {
  const lines = w.segments.map((s) => s.text.trim()).filter(Boolean);
  return { language: w.language || null, lines, instrumental: lines.length === 0 };
}

async function words(input: AnalysisInput, deps: AnalysisStepDeps): Promise<Pick<AnalysisParts, 'words' | 'timings'>> {
  const plan = input.plan.words;
  if (plan.source === 'stored') {
    input.progress(stepText('words'));
    return input.storedWords ? { words: storedWords(input.storedWords), timings: null }
      : { words: { notRead: 'the stored word timings are not readable' }, timings: null };
  }
  let timings: LyricsReading | null = null;
  const lyrics: StepDeps['lyrics'] = async (...a) => (timings = await deps.lyrics(...a));
  const step: PlanStep = plan.source === 'skip' ? plan : { source: 'service' };
  const part = await runStep('words', { ...base(input, 'words'), own: null, step }, stepDeps(deps, { lyrics }));
  return { words: part, timings: isRead(part) ? timings : null };
}

function base(input: AnalysisInput, part: 'words' | 'score') {
  return { audio: input.audio, filename: input.filename, signal: input.signal, progress: (note?: string) => input.progress(stepText(part, note)) };
}

async function score(input: AnalysisInput, deps: AnalysisStepDeps): Promise<{ score: ScorePart | NotRead; run: TranscriptionOutcome | null }> {
  let run: TranscriptionOutcome | null = null;
  const transcribe: StepDeps['transcribe'] = async (...a) => {
    const out = await deps.transcribe(...a);
    run = out ?? null;
    return out;
  };
  const own = input.own ? ({ abc: input.own.abc, lyrics: input.own.lyrics } as OwnSnapshot) : null;
  const plan = input.plan.score;
  const step: PlanStep = plan.source === 'skip' ? plan : { source: plan.source === 'own' ? 'own' : 'service' };
  const part = await runStep('score', { ...base(input, 'score'), own, step }, stepDeps(deps, { transcribe }));
  return { score: part, run };
}

async function grid(input: AnalysisInput, deps: AnalysisStepDeps, run: TranscriptionOutcome | null): Promise<{ grid: unknown; source: BarTimes['source'] } | NotRead> {
  const plan = input.plan.sections;
  if (plan.source === 'skip') return { notRead: plan.why };
  if (plan.source === 'cached') {
    const cached = await deps.readGrid(input.versionId);
    return cached ? { grid: cached, source: cached.source === 'mapped' ? 'mapped' : 'cached' } : { notRead: 'the cached grid is gone' };
  }
  if (plan.source === 'track') {
    input.progress(sections('tracking the beat'));
    run = (await deps.transcribe(input.audio, input.filename, (p) => input.progress(sections(`tracking the beat${pct(p)}`)))) ?? null;
    if (!run) return { notRead: 'cancelled' };
  }
  if (!run) return { notRead: 'the score step ran no transcription to take the beat from' };
  const tracked = await deps.grid(run.yueJobId);
  if (!tracked) return { notRead: 'the transcription kept no downbeat grid', answered: true };
  await deps.writeGrid(input.versionId, tracked).catch(() => false); // the next splice tracks again: no harm
  return { grid: tracked, source: 'tracked' };
}

async function bars(input: AnalysisInput, deps: AnalysisStepDeps, s: ScorePart | NotRead, run: TranscriptionOutcome | null): Promise<BarTimes | NotRead> {
  input.progress(sections());
  try {
    const g = await grid(input, deps, run);
    if ('notRead' in g) return g;
    if (!isRead(s)) return { notRead: `no score to count the bars on: ${s.notRead}` };
    input.progress(sections('timing the bars'));
    const out = await deps.bars(s.abc, g.grid, g.source);
    if (out.ok) return out.bars;
    return out.answered ? { notRead: out.reason, answered: true } : { notRead: out.reason };
  } catch (err) {
    return { notRead: why(err) };
  }
}

/** WORDS > SCORE > SECTIONS; `check` throws when the job was cancelled. */
export async function analyzeSteps(input: AnalysisInput, deps: AnalysisStepDeps, check: () => void): Promise<AnalysisParts> {
  check();
  const w = await words(input, deps);
  check();
  const s = await score(input, deps);
  check();
  const b = await bars(input, deps, s.score, s.run);
  check();
  return { words: w.words, timings: w.timings, score: s.score, bars: b };
}
