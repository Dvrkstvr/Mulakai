/**
 * A version's analysis on its row (`versions.analysis_json`, F-052, docs/decisions/0009) and the facts the view
 * and the mark need around it: the chat's playable version (the base layer's active take, D-120, numbered as
 * the song state numbers it), a version's lineage (`params_json.basedOn`, written by score versions and the
 * splice; else the take made just before it on the same layer, which a repaint or retake has no field for:
 * inferred), its word timings, and the reading chain: the latest analyzed ancestor and how the bars moved
 * since it (barShift along the chain, D-180). Every blob is read loosely: garbage is "not there", never a crash.
 */
import { db } from '../../db/index.js';
import type { LyricsReading } from '../lyricsClient.js';
import type { ScoreSection } from '../score/planTypes.js';
import { isRead } from './reading.js';
import { barShift, composeShifts } from './barShift.js';
import { isFailed, readAnalysis, type BarShift, type StoredAnalysis, type VersionAnalysis } from './analysisTypes.js';
import type { OlderReading } from './analysisView.js';

/** How far the chain is walked: further back than this, the strip waits for the new reading. */
const CHAIN_MAX = 20;

export function readVersionAnalysis(versionId: string): StoredAnalysis | null {
  const row = db.prepare(`SELECT analysis_json FROM versions WHERE id = ?`).get(versionId) as { analysis_json: string | null } | undefined;
  return readAnalysis(row?.analysis_json);
}

/** False when the version is gone (deleted while it was read). */
export function writeAnalysis(a: StoredAnalysis): boolean {
  return db.prepare(`UPDATE versions SET analysis_json = ? WHERE id = ?`).run(JSON.stringify(a), a.versionId).changes > 0;
}

/** 1-based position of a version on its layer, in the order they were made. */
function versionNumber(versionId: string): number | null {
  const row = db.prepare(`SELECT n FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, rowid) AS n FROM versions
    WHERE layer_id = (SELECT layer_id FROM versions WHERE id = ?)) WHERE id = ?`).get(versionId, versionId) as { n: number } | undefined;
  return row?.n ?? null;
}

/** The base layer's active take of a live song, or null. */
export function playableVersion(songId: string): { id: string; number: number } | null {
  const row = db.prepare(`SELECT v.id FROM versions v JOIN layers l ON l.id = v.layer_id JOIN songs s ON s.id = l.song_id
    WHERE s.id = ? AND s.trashed_at IS NULL AND l.kind = 'base' AND v.active = 1 ORDER BY l.position, l.created_at LIMIT 1`)
    .get(songId) as { id: string } | undefined;
  const number = row ? versionNumber(row.id) : null;
  return row && number !== null ? { id: row.id, number } : null;
}

export interface Lineage { fromVersionId: string | null; from: 'basedOn' | 'previous' | null; params: unknown }

function parse(json: string | null | undefined): unknown {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

/** Null for an unknown version. */
export function lineage(versionId: string): Lineage | null {
  const row = db.prepare(`SELECT layer_id, params_json, created_at, rowid AS r FROM versions WHERE id = ?`).get(versionId) as
    { layer_id: string; params_json: string; created_at: string; r: number } | undefined;
  if (!row) return null;
  const params = parse(row.params_json);
  const basedOn = (params as { basedOn?: unknown } | null)?.basedOn;
  if (typeof basedOn === 'string' && basedOn !== versionId && db.prepare(`SELECT 1 FROM versions WHERE id = ?`).get(basedOn)) {
    return { fromVersionId: basedOn, from: 'basedOn', params };
  }
  const prev = db.prepare(`SELECT id FROM versions WHERE layer_id = ? AND (created_at < ? OR (created_at = ? AND rowid < ?))
    ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(row.layer_id, row.created_at, row.created_at, row.r) as { id: string } | undefined;
  return prev ? { fromVersionId: prev.id, from: 'previous', params } : { fromVersionId: null, from: null, params };
}

/** lyrics-server's reading stored by the Editor or WORDS; anything else is none. */
export function wordTimings(versionId: string): LyricsReading | null {
  const row = db.prepare(`SELECT word_timings FROM versions WHERE id = ?`).get(versionId) as { word_timings: string | null } | undefined;
  const w = parse(row?.word_timings) as { language?: unknown; segments?: unknown } | null;
  return w && typeof w.language === 'string' && Array.isArray(w.segments) ? (w as LyricsReading) : null;
}

const done = (a: StoredAnalysis | null): VersionAnalysis | null => (a && !isFailed(a) ? a : null);
const sectionsOf = (a: VersionAnalysis | null): ScoreSection[] | null => (a && isRead(a.score) ? a.score.facts?.sections ?? null : null);

export interface ReadingChain { older: OlderReading | null; olderShift: BarShift; parent: { versionId: string; shift: BarShift } | null }

/** Walks the lineage up from a version to its latest analyzed ancestor (failed readings are skipped). */
export function readingChain(versionId: string): ReadingChain {
  const shifts: BarShift[] = [];
  const seen = new Set([versionId]);
  let parent: ReadingChain['parent'] = null;
  let cur = versionId;
  for (let i = 0; i < CHAIN_MAX; i++) {
    const lin = lineage(cur);
    if (!lin?.fromVersionId || seen.has(lin.fromVersionId)) break;
    const from = lin.fromVersionId;
    const analysis = done(readVersionAnalysis(from));
    const shift = barShift({ params: lin.params, baseSections: sectionsOf(analysis) });
    shifts.unshift(shift);
    parent ??= { versionId: from, shift };
    if (analysis) {
      const number = versionNumber(from) ?? 0;
      return { older: { versionId: from, number, analysis, words: wordTimings(from) }, olderShift: composeShifts(shifts), parent };
    }
    seen.add(from);
    cur = from;
  }
  return { older: null, olderShift: { moved: false }, parent };
}
