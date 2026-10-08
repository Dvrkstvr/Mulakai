/**
 * Is RE-TIME offered on this song's score (RT-4, F-093, D-233)? Only while the active base version is still the
 * transcription a cover was made from: the cover's own take (`task_type: 'cover'` with a kept `notationId`), or a
 * score version that only re-timed it (its params carry `retime.notationId`). After any other SCORE edit a
 * re-time from the kept reading would undo it, so the dock says why instead. The reading's tempo comes from the
 * kept beat list (not the ABC: decision 0002), so the chips always start from what SheetSage2 read (D-231).
 */
import { db } from '../../db/index.js';
import { loadNotation } from '../notationStore.js';
import type { NotationBundle } from './yueRetime.js';

export type RetimeOffer =
  | { state: 'none' }
  | { state: 'refused'; reason: string }
  | { state: 'offered'; notationId: string; readBpm: number };

export const EDITED_SINCE = 'it rebuilds the score as transcribed, and this take was edited since: re-timing would undo those edits · use SET TEMPO, or cover the source again';
export const READING_GONE = 'the saved reading of the source is gone: TRANSCRIBE it again in Create to re-time it';

interface Params { task_type?: unknown; notationId?: unknown; ops?: unknown; retime?: { notationId?: unknown } }

const id = (v: unknown) => (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : null);
const onlyRetimes = (ops: unknown) => Array.isArray(ops) && ops.length > 0 && ops.every((o) => (o as { op?: unknown })?.op === 'RETIME');

/** Pure: the active base version's params and every base version's params (oldest first) → the offer's kept id. */
export function decideRetime(active: Params | null, versions: Params[]): { notationId: string } | { refused: string } | null {
  const cover = versions.find((p) => p.task_type === 'cover');
  if (!cover || !active) return null; // not a cover: no transcription to re-time
  if (active.task_type === 'cover') return id(active.notationId) ? { notationId: id(active.notationId)! } : { refused: READING_GONE };
  if (active.task_type === 'score' && onlyRetimes(active.ops)) {
    const kept = id(active.retime?.notationId);
    return kept ? { notationId: kept } : { refused: READING_GONE };
  }
  return { refused: EDITED_SINCE };
}

/** The tempo the kept beat list reads as: 60 / the median gap (yue-server's retime_beats.read_bpm). */
export function readBpmOf(bundle: NotationBundle): number | null {
  const raw = bundle.files['song_beats.txt'];
  if (!raw) return null;
  const times = Buffer.from(raw, 'base64').toString('utf8').split('\n').filter((l) => l.trim()).map((l) => Number(l.split('\t')[0])).filter(Number.isFinite);
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  if (!gaps.length) return null;
  const mid = gaps.length >> 1;
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return median > 0 ? Math.round((60 / median) * 10) / 10 : null;
}

const parse = (json: string): Params => { try { return JSON.parse(json) as Params; } catch { return {}; } };

export async function retimeOffer(songId: string, load = loadNotation): Promise<RetimeOffer> {
  const rows = db.prepare(
    `SELECT v.params_json AS p, v.active AS a FROM versions v JOIN layers l ON l.id = v.layer_id
     WHERE l.song_id = ? AND l.kind = 'base' ORDER BY v.created_at, v.id`,
  ).all(songId) as { p: string; a: number }[];
  const decided = decideRetime(rows.find((r) => r.a === 1) ? parse(rows.find((r) => r.a === 1)!.p) : null, rows.map((r) => parse(r.p)));
  if (!decided) return { state: 'none' };
  if ('refused' in decided) return { state: 'refused', reason: decided.refused };
  const bundle = await load(decided.notationId);
  const readBpm = bundle && readBpmOf(bundle);
  return readBpm ? { state: 'offered', notationId: decided.notationId, readBpm } : { state: 'refused', reason: READING_GONE };
}
