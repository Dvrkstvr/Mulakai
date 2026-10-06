/**
 * An analyze card's target (architecture "Chat (C3)" flow 2-3): `planFor` is where each reading step
 * would run, for the READ card's GPU estimate (CR-2's readingPlan, D-148 d; turnDeps().plan); a
 * library song named in words is priced from its song row, its score counted as its own when YuE2
 * made it (inferred: a YuE2 song keeps its score sidecar). `materialise` turns the target into the
 * thread's reference at READ: an attached one as is, a library song copied now (referenceStore).
 */
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { yue2Engine } from '../engines/yue2.js';
import { planSources, readingPlan, type Services } from './readingPlan.js';
import { fromLibrary, getReference, OWN_V, type OwnSnapshot, type Reference } from './referenceStore.js';
import type { ReadingPlanSources } from './reading.js';
import type { AnalyzeTarget } from './chatTypes.js';

/** The services as configured (ACE-Step's health is not asked here: the card is an estimate). */
export const configuredServices = (): Services => ({ lyrics: Boolean(config.lyricsUrl), yue: Boolean(yue2Engine.url), acestep: Boolean(config.acestepUrl) });

interface SongRow { engine: string | null; lyrics: string | null; caption: string | null }

function ownOf(target: AnalyzeTarget): OwnSnapshot | null {
  if ('referenceId' in target) return getReference(target.referenceId)?.own ?? null;
  const song = db.prepare(`SELECT engine, lyrics, caption FROM songs WHERE id = ?`).get(target.songId) as SongRow | undefined;
  if (!song) return null;
  return {
    own_v: OWN_V, abc: song.engine === 'yue2' ? 'own score' : null, lyrics: song.lyrics || null, caption: song.caption || null,
    bpm: null, key: null, meter: null, engine: song.engine, layers: 1,
  };
}

export function planFor(target: AnalyzeTarget, services: Services = configuredServices()): ReadingPlanSources {
  return planSources(readingPlan(ownOf(target), services));
}

export const NOT_ATTACHED = 'this reference is no longer attached: attach it again';

/** The reference READ reads, or why it cannot. */
export async function materialise(threadId: string, target: AnalyzeTarget, library = fromLibrary): Promise<{ reference: Reference } | { reason: string }> {
  if ('referenceId' in target) {
    const ref = getReference(target.referenceId);
    return ref && ref.threadId === threadId ? { reference: ref } : { reason: NOT_ATTACHED };
  }
  const added = await library(threadId, target.songId);
  return added.ok ? { reference: added.reference } : { reason: added.reason };
}
