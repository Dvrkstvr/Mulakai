/**
 * RE-TIME a chat reading (RT-5, F-092, D-231): the playable version's transcribed score is rebuilt from its kept
 * notation bundle at half time, double time or a named BPM (yue-server, CPU, no queue slot), read and measured like
 * the SCORE step reads one, and its bar i starts at the re-timed beat list's downbeat i: SheetSage2 builds the score
 * from that very list, so there is nothing to fit (a chord-agreement fit on half-time bars picked a +4 bar offset on
 * a real song, 17 s late). Bars past the audio (the cached grid's duration) are not timed. The re-timed reading replaces the stored one with a new `readAt`, so a
 * mark made on the old bars no longer fits (`resolveRange`); UNDO restores the reading as read, `readAt` included.
 * Every refusal changes nothing. Over injected clients; the route writes the result.
 */
import type { ScoreSize } from '../engineTranscribeClient.js';
import type { NotationBundle, RetimeMode, RetimeResult } from '../score/yueRetime.js';
import { RetimeRefused } from '../score/yueRetime.js';
import type { ScoreRead } from '../score/yueScoreRead.js';
import { isFailed, type BarTimes, type StoredAnalysis, type VersionAnalysis } from './analysisTypes.js';
import type { Grid } from './gridCache.js';
import { isRead, type ScorePart } from './reading.js';
import { retimeOffer } from './retimeRecord.js';

export interface ReadingRetimeDeps {
  load: (notationId: string) => Promise<NotationBundle | null>;
  retime: (bundle: NotationBundle, mode: RetimeMode, bpm: number | null) => Promise<RetimeResult>;
  readScore: (abc: string) => Promise<ScoreRead>;
  measure: (abc: string) => Promise<ScoreSize | null>;
  readGrid: (versionId: string) => Promise<Grid | null>;
  now: () => Date;
}

export interface RetimeChoice { mode: RetimeMode; bpm: number | null }
/** 409: the reading cannot be re-timed as it stands; 422: yue-server or the bar fit refused (`code`); 502: down. */
export type RetimeOutcome = { ok: true; analysis: VersionAnalysis } | { ok: false; status: 409 | 422 | 502; code: string; reason: string };

const refuse = (status: 409 | 422 | 502, code: string, reason: string): RetimeOutcome => ({ ok: false, status, code, reason });
const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The reading as stored, if it can be re-timed at all: done, its own transcribed score with facts and bar times. */
function retimable(a: StoredAnalysis | null): { a: VersionAnalysis; score: ScorePart } | string {
  if (!a || isFailed(a)) return 'this version has no reading to re-time';
  if (!retimeOffer(a.score, a.retime) || !isRead(a.score)) return "only a transcribed score is re-timed: a YuE2 song's own score is what YuE2 rendered";
  if (!isRead(a.bars)) return 'this reading has no bar times to re-time';
  return { a, score: a.score };
}

/** Score bar i on downbeat i, for the bars the audio holds; the last timed bar ends at the next downbeat or the audio's
 * end. The audio's length is the cached grid's (the tracker read it), else the reading's own last bar end. */
async function timeBars(versionId: string, downbeats: number[], bars: number, before: BarTimes, deps: ReadingRetimeDeps): Promise<BarTimes | string> {
  const grid = await deps.readGrid(versionId);
  const duration = typeof grid?.duration === 'number' ? grid.duration : before.end;
  const starts = downbeats.filter((t, i) => t < duration && (i === 0 || t > downbeats[i - 1])).slice(0, bars);
  if (!starts.length) return 'none of the re-timed bars falls inside the audio';
  const next = downbeats[downbeats.indexOf(starts[starts.length - 1]) + 1];
  return { source: 'cached', offset: 0, starts, end: next !== undefined && next <= duration ? next : duration, agreement: null };
}

export async function retimeReading(stored: StoredAnalysis | null, choice: RetimeChoice, deps: ReadingRetimeDeps): Promise<RetimeOutcome> {
  const r = retimable(stored);
  if (typeof r === 'string') return refuse(409, 'not_retimable', r);
  const { a, score } = r;
  const bundle = score.notationId ? await deps.load(score.notationId) : null;
  if (!bundle) return refuse(422, 'no_bundle', 'the saved reading is gone');
  let out: RetimeResult;
  try {
    out = await deps.retime(bundle, choice.mode, choice.mode === 'bpm' ? choice.bpm : null);
  } catch (err) {
    return err instanceof RetimeRefused ? refuse(422, err.code, err.message) : refuse(502, 'retime_failed', why(err));
  }
  const read = await deps.readScore(out.abc).catch((err: unknown) => ({ ok: false, error: why(err) }) as ScoreRead);
  if (!read.ok || !read.facts) return refuse(422, 'retime_refused', `the re-timed score does not read: ${read.error ?? 'no facts'}`);
  const bars = await timeBars(a.versionId, out.downbeats, read.facts.header.bars, a.bars as BarTimes, deps).catch((err: unknown) => why(err));
  if (typeof bars === 'string') return refuse(422, 'bars', bars);
  const measure = await deps.measure(out.abc).catch(() => null);
  const asRead = a.retime?.previous ?? { readAt: a.readAt, score, bars: a.bars };
  const facts = 'notRead' in asRead.score ? null : asRead.score.facts;
  return {
    ok: true,
    analysis: {
      ...a, readAt: deps.now().toISOString(), bars,
      score: { ...score, abc: out.abc, chords: read.chordsPresent, facts: read.facts, measure, warnings: [...out.warnings, ...read.messages] },
      retime: {
        mode: choice.mode, bpm: Math.round(out.bpm ?? read.facts.header.bpm), fromBpm: facts?.header.bpm ?? Math.round(out.readBpm),
        fromBars: facts?.header.bars ?? 0, toBars: read.facts.header.bars, droppedNotes: out.droppedNotes, notes: out.notes,
        at: deps.now().toISOString(), previous: asRead,
      },
    },
  };
}

/** UNDO: the reading as SheetSage2 read it, its `readAt` with it. */
export function undoReadingRetime(stored: StoredAnalysis | null): VersionAnalysis | null {
  if (!stored || isFailed(stored) || !stored.retime) return null;
  const { retime, ...rest } = stored;
  return { ...rest, readAt: retime.previous.readAt, score: retime.previous.score, bars: retime.previous.bars };
}
