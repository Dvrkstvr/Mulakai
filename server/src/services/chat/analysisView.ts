/**
 * The player's view of a song's analysis (F-053, F-052's states, D-179, D-180), pure: the playable version's
 * state (none, queued, running step, done, failed), the reading the strip shows and the playable version's
 * lineage for the client's `markStale`. The shown reading is the playable version's own (`current`, or
 * `hatched` when its bars were not read), else the latest older one: `dim` (clickable) when the edits since
 * moved no bars, `hatched` when they did or the current reading failed (mark by time: `bars` is null; the
 * sections keep that older reading's seconds for drawing only). Strip sections are the score's, a section with
 * no lyric block included (F-053 #1); lines come from YuE2's lyric blocks, or for a transcribed score from the
 * word timings inside each section (lines crossing an edge count in both sections, as partial).
 */
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsReading } from '../lyricsClient.js';
import { isRead } from './reading.js';
import {
  isFailed, type AnalysisState, type AnalysisStep, type AnalysisView, type BarShift, type LiveAnalysisJob,
  type ShownReading, type StoredAnalysis, type StripSection, type VersionAnalysis,
} from './analysisTypes.js';

export interface OlderReading { versionId: string; number: number; analysis: VersionAnalysis; words: LyricsReading | null }
export interface ViewInput {
  songId: string;
  /** The base layer's active take (D-120) and its number; null when the song has none. */
  playable: { id: string; number: number } | null;
  current: StoredAnalysis | null;
  /** The playable version's `word_timings`. */
  currentWords: LyricsReading | null;
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

export function stripSections(facts: ScoreFacts, bars: Bars | null, words: LyricsReading | null): StripSection[] {
  const seen = new Map<string, number>();
  return facts.sections.map((s) => {
    const occurrence = (seen.get(s.label) ?? 0) + 1;
    seen.set(s.label, occurrence);
    const seconds = secondsOf(s.from_bar, s.to_bar, bars);
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
      const block = facts.lyric_blocks.find((l) => l.tag.toLowerCase() === s.label.toLowerCase() && l.occurrence === occurrence);
      lines = block?.lines ?? 0;
    }
    return { index: s.index, label: s.label, occurrence, bars: [s.from_bar, s.to_bar], seconds, lines, partialLines };
  });
}

function shown(a: VersionAnalysis, number: number, words: LyricsReading | null, dimOrHatched: 'dim' | 'hatched' | null): ShownReading {
  const bars = isRead(a.bars) ? { starts: a.bars.starts, end: a.bars.end } : null;
  const facts = isRead(a.score) ? a.score.facts : null;
  const transcribed = isRead(a.score) && a.score.source === 'transcribed';
  const own = facts !== null && !transcribed;
  const mode = !bars ? 'hatched' : dimOrHatched ?? 'current';
  return {
    versionId: a.versionId, number, mode, readAt: a.readAt,
    bars: mode === 'hatched' ? null : bars,
    sections: facts ? stripSections(facts, bars, transcribed ? words : null) : [],
    lines: own ? facts.lyric_blocks.reduce((n, b) => n + b.lines, 0)
      : isRead(a.words) ? a.words.lines.length : words?.segments.length ?? 0,
    transcribed,
    notRead: {
      words: isRead(a.words) ? null : a.words.notRead,
      score: isRead(a.score) ? null : a.score.notRead,
      bars: isRead(a.bars) ? null : a.bars.notRead,
    },
  };
}

function state(current: StoredAnalysis | null, job: LiveAnalysisJob | null): AnalysisState {
  if (job?.status === 'queued') return { kind: 'queued', jobId: job.jobId, ahead: job.ahead };
  if (job) {
    const word = job.progressText?.split(/\s/)[0] as AnalysisStep | undefined;
    return { kind: 'running', jobId: job.jobId, step: word && STEPS.includes(word) ? word : null, progress: job.progressText };
  }
  if (!current) return { kind: 'none' };
  return isFailed(current) ? { kind: 'failed', reason: current.failed, at: current.at } : { kind: 'done' };
}

export function analysisView(input: ViewInput): AnalysisView {
  const { songId, playable, current, older } = input;
  if (!playable) return { songId, versionId: null, number: null, state: { kind: 'none' }, shown: null, lineage: null };
  const failed = current !== null && isFailed(current);
  const view = current && !isFailed(current) ? shown(current, playable.number, input.currentWords, null)
    : older ? shown(older.analysis, older.number, older.words, failed || input.olderShift.moved ? 'hatched' : 'dim')
    : null;
  const p = input.parent;
  return {
    songId, versionId: playable.id, number: playable.number, state: state(current, input.job), shown: view,
    lineage: p ? { fromVersionId: p.versionId, moved: p.shift.moved, shift: p.shift.moved ? p.shift.shift : null } : null,
  };
}
