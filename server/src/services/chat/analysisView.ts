/**
 * The player's view of a song's analysis (F-053, F-052's states, D-179, D-180), pure: the playable version's
 * state (none, queued, running step, done, failed), the reading the strip shows and the playable version's
 * lineage for the client's `markStale`. The shown reading is the playable version's own (`current`, or
 * `hatched` when its bars were not read), else the latest older one: `dim` (clickable) when the edits since
 * moved no bars and kept their seconds, `hatched` when they moved or re-timed them (a SET TEMPO) or the current
 * reading failed (mark by time: `bars` is null; the
 * sections keep that older reading's seconds for drawing only). Strip sections are the score's, a section with
 * no lyric block included (F-053 #1), cut to the bars the audio holds (D-197); lines come from YuE2's lyric
 * blocks, or for a transcribed score from the word timings inside each section (lines crossing an edge count in
 * both sections, as partial). The reading line's total comes from the same pairing (`readingLines`, C1 live B4).
 */
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';
import { isRead } from './reading.js';
import { readingLines } from './readingLines.js';
import { pairBlocks } from '../score/lyricPairing.js';
import { lyricsPanel } from './lyricsPanel.js';
import {
  isFailed, readingGap, type AnalysisState, type AnalysisStep, type AnalysisView, type BarShift, type LiveAnalysisJob,
  type ShownReading, type StoredAnalysis, type StripSection, type VersionAnalysis, type VersionText,
} from './analysisTypes.js';

export interface OlderReading {
  versionId: string; number: number; analysis: VersionAnalysis; words: LyricsReading | null;
  /** Its stored lyrics and style, for the lyrics panel (C2); absent = none stored. */
  text?: VersionText | null;
}
export interface ViewInput {
  songId: string;
  /** The base layer's active take (D-120) and its number; null when the song has none. */
  playable: { id: string; number: number } | null;
  current: StoredAnalysis | null;
  /** The playable version's `word_timings`. */
  currentWords: LyricsReading | null;
  /** The playable version's stored lyrics and style (`versionLyrics`), for `shown.lyrics` (C2). */
  currentText?: VersionText | null;
  /** The latest analyzed ancestor (analysisStore walks the lineage), and the bars' movement since it. */
  older: OlderReading | null;
  olderShift: BarShift;
  /** The playable version against its parent, one step. */
  parent: { versionId: string; shift: BarShift } | null;
  job: LiveAnalysisJob | null;
}

type Bars = { starts: number[]; end: number };
const STEPS: AnalysisStep[] = ['WORDS', 'SCORE', 'SECTIONS'];

function secondsOf(from: number, to: number, bars: Bars | null): [number, number] | null {
  if (!bars || from < 1 || from > bars.starts.length || to < from) return null;
  const end = to < bars.starts.length ? bars.starts[to] : to === bars.starts.length ? bars.end : null;
  return end === null ? null : [bars.starts[from - 1], end];
}

/** Bars of the score past the last bar the audio holds (D-197: a transcribed score can outlast its audio). */
export function barsPastAudio(facts: ScoreFacts, bars: Bars | null): number {
  const last = Math.max(0, ...facts.sections.map((s) => s.to_bar));
  return bars ? Math.max(0, last - bars.starts.length) : 0;
}

/** D-197: with bar times, a section past the audio's last bar is dropped and one crossing it ends there. */
export function stripSections(facts: ScoreFacts, bars: Bars | null, words: LyricsReading | null): StripSection[] {
  const seen = new Map<string, number>();
  const sung = pairBlocks(facts.sections, facts.lyric_blocks);
  const held = bars ? bars.starts.length : Infinity;
  return facts.sections.flatMap((s) => {
    const occurrence = (seen.get(s.label) ?? 0) + 1;
    seen.set(s.label, occurrence);
    if (s.from_bar > held) return [];
    const to = Math.min(s.to_bar, held);
    const seconds = secondsOf(s.from_bar, to, bars);
    let lines = 0;
    let partialLines = 0;
    if (words) {
      if (seconds) {
        const [a, b] = seconds;
        const touching = words.segments.filter((w) => w.start < b && w.end > a);
        lines = touching.length;
        partialLines = touching.filter((w) => w.start < a || w.end > b).length;
      }
    } else {
      // D-066 d: the k-th section of a kind sings the k-th block of it (tags are `[Verse]`, labels `verse`; CP-C1)
      lines = facts.lyric_blocks.find((l) => l.index === sung.get(s.index))?.lines ?? 0;
    }
    return [{ index: s.index, label: s.label, occurrence, bars: [s.from_bar, to], seconds, lines, partialLines }];
  });
}

function shown(a: VersionAnalysis, number: number, words: LyricsReading | null, text: VersionText | null | undefined, dimOrHatched: 'dim' | 'hatched' | null): ShownReading {
  const bars = isRead(a.bars) ? { starts: a.bars.starts, end: a.bars.end } : null;
  const facts = isRead(a.score) ? a.score.facts : null;
  const transcribed = isRead(a.score) && a.score.source === 'transcribed';
  const mode = !bars ? 'hatched' : dimOrHatched ?? 'current';
  const timings = transcribed ? words : null;
  const sections = facts ? stripSections(facts, bars, timings) : [];
  const heard = isRead(a.words) ? a.words.lines.length : words?.segments.length ?? 0;
  const { lines, outside } = readingLines(facts, sections, timings, bars !== null, heard);
  return {
    versionId: a.versionId, number, mode, readAt: a.readAt,
    bars: mode === 'hatched' ? null : bars,
    sections,
    barsNotShown: facts ? barsPastAudio(facts, bars) : 0,
    lines, linesOutside: outside,
    transcribed,
    notRead: {
      words: isRead(a.words) ? null : a.words.notRead,
      score: isRead(a.score) ? null : a.score.notRead,
      bars: isRead(a.bars) ? null : a.bars.notRead,
    },
    lyrics: lyricsPanel({ analysis: a, sections, words, lyrics: text?.lyrics ?? null, style: text?.style ?? null }),
  };
}

function state(current: StoredAnalysis | null, job: LiveAnalysisJob | null): AnalysisState {
  if (job?.status === 'queued') return { kind: 'queued', jobId: job.jobId, ahead: job.ahead };
  if (job) {
    const word = job.progressText?.split(/\s/)[0] as AnalysisStep | undefined;
    return { kind: 'running', jobId: job.jobId, step: word && STEPS.includes(word) ? word : null, progress: job.progressText };
  }
  if (!current) return { kind: 'none' };
  if (isFailed(current)) return { kind: 'failed', reason: current.failed, at: current.at };
  // C1 live B1: a step whose service failed is not done; its parts read are still shown (the strip, the mark).
  const gap = readingGap(current);
  return gap ? { kind: 'failed', reason: gap, at: current.readAt } : { kind: 'done' };
}

export function analysisView(input: ViewInput): AnalysisView {
  const { songId, playable, current, older } = input;
  if (!playable) return { songId, versionId: null, number: null, state: { kind: 'none' }, shown: null, lineage: null };
  const failed = current !== null && isFailed(current);
  const view = current && !isFailed(current) ? shown(current, playable.number, input.currentWords, input.currentText, null)
    : older ? shown(older.analysis, older.number, older.words, older.text, failed || input.olderShift.moved || input.olderShift.retimed ? 'hatched' : 'dim')
    : null;
  const p = input.parent;
  return {
    songId, versionId: playable.id, number: playable.number, state: state(current, input.job), shown: view,
    lineage: p ? { fromVersionId: p.versionId, moved: p.shift.moved, shift: p.shift.moved ? p.shift.shift : null, retimed: !p.shift.moved && !!p.shift.retimed } : null,
  };
}
