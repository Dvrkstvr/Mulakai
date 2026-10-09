/**
 * A chat RE-TIME around the planner (RT-6, F-094; retime.html D1-D5): the facts `routeRetime` decides on, read before
 * the planner loads (the dock's offer, the playable version's reading offer), and an accepted route resolved after the
 * unload, inside the turn's slot (CPU on yue-server, no model): the dock's plan, built but stored only once its card is
 * written (`buildRetimePlan`, F-093), or the reading re-timed (`retimeReading`, F-092), written with the reply in its
 * transaction (`writeRetimed`) so a failed turn changes nothing. Every refusal is the reason, said in the thread.
 */
import { measureScore } from '../engineTranscribeClient.js';
import { yue2Engine } from '../engines/yue2.js';
import { loadNotation } from '../notationStore.js';
import type { Plan, Since } from '../score/planTypes.js';
import { retimeOffer as dockOffer } from '../score/retimeOffer.js';
import { buildRetimePlan } from '../score/retimePlan.js';
import { retimeScore, type RetimeMode } from '../score/yueRetime.js';
import { readScore } from '../score/yueScoreRead.js';
import { analysisPending } from './analysisJob.js';
import { playableVersion, readVersionAnalysis, writeAnalysis } from './analysisStore.js';
import { isFailed, type StoredAnalysis, type VersionAnalysis } from './analysisTypes.js';
import type { EditBase, RetimeDoneBody } from './editTypes.js';
import { readGrid } from './gridCache.js';
import { retimeReading, type ReadingRetimeDeps } from './readingRetime.js';
import { retimeOffer as readingOffer } from './retimeRecord.js';
import type { RetimeRoute } from './retimeReply.js';
import type { VerbFacts } from './retimeVerb.js';

export interface RetimeDeps {
  facts: (songId: string) => Promise<VerbFacts>;
  /** The dock's plan (not stored). */
  plan: (songId: string, mode: RetimeMode, bpm: number | null) => Promise<Plan>;
  reading: ReadingRetimeDeps;
}
export type RetimeResolved =
  | { kind: 'dock'; plan: Plan; base: EditBase }
  | { kind: 'reading'; done: RetimeDoneBody['retime']; analysis: VersionAnalysis; stamp: string | null }
  | { kind: 'refused'; reason: string };

/** The reading re-time's clients (the reading line's RE-TIME route uses the same). */
export const readingRetimeDeps = (): ReadingRetimeDeps => ({
  load: loadNotation,
  retime: (bundle, mode, bpm) => retimeScore(bundle, mode, bpm),
  readScore: (abc) => readScore(abc, null, yue2Engine),
  measure: (abc) => measureScore(yue2Engine, abc),
  readGrid,
  now: () => new Date(),
});

const stampOf = (a: StoredAnalysis | null) => (a && !isFailed(a) ? a.readAt : null);

export async function verbFacts(songId: string): Promise<VerbFacts> {
  const take = playableVersion(songId);
  const a = take ? readVersionAnalysis(take.id) : null;
  return { dock: await dockOffer(songId), reading: a && !isFailed(a) ? readingOffer(a.score, a.retime) : null };
}

export const retimeDeps = (): RetimeDeps => ({ facts: verbFacts, plan: (songId, mode, bpm) => buildRetimePlan(songId, mode, bpm), reading: readingRetimeDeps() });

const refused = (reason: string): RetimeResolved => ({ kind: 'refused', reason });
const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** A re-time that threw (the saved reading unreadable, ...): the failed turn's line names it, not the planner (review 6). */
export const retimeFailed = (err: unknown) => `the re-time failed: ${why(err)} · nothing changed`;

/** `base`: the song's edit base (the dock card's splice and bar map), or why it cannot be edited. `tried`: the planner's
 * attempts and refused replies, shown on the card as on any edit card; `since` / `revision`: a start over of a pending
 * plan (D-274), its ops REMOVED on the card as any revise's. */
export async function resolveRetime(route: RetimeRoute, songId: string, base: EditBase | { reason: string } | null,
  tried: { attempts: number; refusals: string[][]; since?: Since | null; revision?: number }, deps: RetimeDeps): Promise<RetimeResolved> {
  if (route.kind === 'dock') {
    if (!base || 'reason' in base) return refused(base?.reason ?? 'its score could not be read');
    const plan = await deps.plan(songId, route.mode, route.bpm).catch((err: unknown) => why(err));
    const since = tried.since ? { since: tried.since, revision: tried.revision } : {};
    return typeof plan === 'string' ? refused(plan) : { kind: 'dock', plan: { ...plan, attempts: tried.attempts, refusals: tried.refusals, ...since }, base };
  }
  const take = playableVersion(songId);
  if (!take) return refused('this song has no version to re-time');
  if (analysisPending(songId, take.id)) return refused(`v${take.number} is being read`);
  const stored = readVersionAnalysis(take.id);
  const out = await retimeReading(stored, { mode: route.mode, bpm: route.bpm }, deps.reading);
  if (!out.ok) return refused(out.reason);
  const r = out.analysis.retime!;
  const done = { songId, versionId: take.id, number: take.number, mode: r.mode, bpm: r.bpm, fromBpm: r.fromBpm, fromBars: r.fromBars,
    toBars: r.toBars, droppedNotes: r.droppedNotes, notes: r.notes, readAt: out.analysis.readAt, asReadAt: r.previous.readAt };
  return { kind: 'reading', done, analysis: out.analysis, stamp: stampOf(stored) };
}

export const RETIME_RACE = 'the reading changed while it was re-timed: nothing changed';
/** Inside the reply's transaction: the re-timed reading replaces the stored one; false (nothing written) when it changed meanwhile. */
export function writeRetimed(r: Extract<RetimeResolved, { kind: 'reading' }>): boolean {
  return stampOf(readVersionAnalysis(r.done.versionId)) === r.stamp && writeAnalysis(r.analysis);
}
