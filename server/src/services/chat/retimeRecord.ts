/**
 * A re-timed chat reading (RT-5, F-092, D-231): what `versions.analysis_json` keeps beside the re-timed score and
 * bar times, and what the player's READ AS row is offered. A re-time always starts from what SheetSage2 read (the
 * kept notation bundle), so `previous` is always that first reading, never an earlier re-time: UNDO is one step back
 * to it. Read loosely from the raw blob: a broken record is no record (no UNDO), never a crash. Pure.
 */
import type { NotRead, ScorePart } from './reading.js';
import type { BarTimes } from './analysisTypes.js';

export type RetimeMode = 'half' | 'double' | 'bpm';

export interface ReadingRetime {
  mode: RetimeMode;
  /** The re-timed tempo and what SheetSage2 read. */
  bpm: number;
  fromBpm: number;
  fromBars: number;
  toBars: number;
  /** Notes the slower grid could not hold (D-210), of `notes`. */
  droppedNotes: number;
  notes: number;
  at: string;
  /** The reading as SheetSage2 read it: UNDO puts it back, its `readAt` with it (a mark made on it fits again). */
  previous: { readAt: string; score: ScorePart; bars: BarTimes | NotRead };
}

/** The READ AS row's facts (`ShownReading.retime`): the reading as read, the kept bundle (null: TRANSCRIBE AGAIN),
 * and the re-time in place, if any. Offered only on the playable version's own transcribed reading. */
export interface RetimeOffer {
  notationId: string | null;
  read: { bpm: number; bars: number };
  retimed: Omit<ReadingRetime, 'previous' | 'at'> | null;
}

type PartReader = (name: 'score' | 'bars', v: unknown) => object;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MODES = new Set(['half', 'double', 'bpm']);
const NUMS = ['bpm', 'fromBpm', 'fromBars', 'toBars', 'droppedNotes', 'notes'] as const;

/** The stored record, or undefined (none, or not readable). `part` is analysisTypes' own part reader. */
export function readRetime(v: unknown, part: PartReader): ReadingRetime | undefined {
  if (!isObject(v) || !MODES.has(v.mode as string) || typeof v.at !== 'string' || !NUMS.every((k) => isNum(v[k]))) return undefined;
  const p = v.previous;
  if (!isObject(p) || typeof p.readAt !== 'string') return undefined;
  const score = part('score', p.score);
  if ('notRead' in score) return undefined; // only a read score is ever re-timed
  const nums = Object.fromEntries(NUMS.map((k) => [k, v[k]])) as Pick<ReadingRetime, (typeof NUMS)[number]>;
  return { mode: v.mode as RetimeMode, ...nums, at: v.at, previous: { readAt: p.readAt, score: score as ScorePart, bars: part('bars', p.bars) as BarTimes | NotRead } };
}

/** The row's offer for a reading whose score was read: a transcription only (a YuE2 song's own score is what YuE2
 * rendered: SET TEMPO / SCORE, F-092 non-goal), with its facts as read. */
export function retimeOffer(score: ScorePart | NotRead, retime: ReadingRetime | undefined): RetimeOffer | null {
  if ('notRead' in score || score.source !== 'transcribed' || !score.facts) return null;
  const { previous, at: _at, ...retimed } = retime ?? ({} as Partial<ReadingRetime>);
  const asRead = previous && !('notRead' in previous.score) ? previous.score.facts : score.facts;
  if (!asRead) return null;
  return {
    notationId: score.notationId ?? null,
    read: { bpm: retime ? retime.fromBpm : asRead.header.bpm, bars: retime ? retime.fromBars : asRead.header.bars },
    retimed: retime ? (retimed as RetimeOffer['retimed']) : null,
  };
}
