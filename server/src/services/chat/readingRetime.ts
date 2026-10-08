/**
 * RE-TIME a chat reading (RT-5, F-092, D-231): the playable version's transcribed score is rebuilt from its kept
 * notation bundle at half time, double time or a named BPM (yue-server, CPU, no queue slot), read and measured like
 * the SCORE step reads one, and its bars are timed by `/v1/scores/bars` on the version's cached grid with the
 * downbeats swapped for the re-timed beat list's (the tracker's chord rows and duration stay: the audio did not
 * change, only how its beat is counted). The re-timed reading replaces the stored one with a new `readAt`, so a
 * mark made on the old bars no longer fits (`resolveRange`); UNDO restores the reading as read, `readAt` included.
 * Every refusal changes nothing. Over injected clients; the route writes the result.
 */
import type { ScoreSize } from '../engineTranscribeClient.js';
import type { NotationBundle, RetimeMode, RetimeResult } from '../score/yueRetime.js';
import { RetimeRefused } from '../score/yueRetime.js';
import type { BarsResult } from '../score/yueScoreBars.js';
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
  bars: (abc: string, grid: unknown, source: BarTimes['source']) => Promise<BarsResult>;
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

/** The rebuilt score's bar times on the re-timed grid (the cached grid's chord rows and duration). */
async function timeBars(abc: string, versionId: string, downbeats: number[], deps: ReadingRetimeDeps): Promise<BarTimes | string> {
  const grid = await deps.readGrid(versionId);
  if (!grid) return 'the beat grid of this version is gone: read it again to re-time it';
  const duration = typeof grid.duration === 'number' ? grid.duration : Infinity;
  const kept = downbeats.filter((t) => t <= duration);
  if (kept.length < 2) return 'the re-timed beat list has fewer than 2 bars inside the audio';
  const out = await deps.bars(abc, { ...grid, downbeats: kept }, 'cached');
  return out.ok ? out.bars : `the re-timed bars could not be timed: ${out.reason}`;
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
  const bars = await timeBars(out.abc, a.versionId, out.downbeats, deps).catch((err: unknown) => why(err));
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
