/**
 * When a song's playable version gets analyzed (F-052, D-172): after a job that can change audio settles `done`
 * on a song with a chat thread (`jobEvents`, subscribed at start), and on GET of a song's thread (`ensureAnalysis`:
 * imports and songs older than C1). The rule is pure (`shouldAnalyze`): the song has a thread and a playable
 * version that has no stored analysis (a failed one waits for RETRY) and no analysis waiting for or reading it.
 * A trigger never throws: a full queue or a broken row is logged, and the next save or thread GET tries again.
 */
import { db } from '../../db/index.js';
import type { GenKind } from '../genQueue.js';
import { onJobSettled, type JobSettled } from '../jobEvents.js';
import type { Job } from '../jobRegistry.js';
import { analysisPending, startAnalysis } from './analysisJob.js';
import { playableVersion, readVersionAnalysis } from './analysisStore.js';

/** Kinds whose `done` can leave a new take (the analysis's own `transcribe` is not one). */
export const AUDIO_KINDS: readonly GenKind[] = ['generate', 'repaint', 'regenerate', 'retake', 'addLayer', 'split', 'scoreRender'];

export interface SongFacts {
  hasThread: boolean;
  /** The base layer's active take, if any. */
  playable: boolean;
  /** It has a stored analysis, read or failed. */
  analyzed: boolean;
  /** An analysis waits for the song or is reading that take. */
  pending: boolean;
}

/** `event` null: the thread GET. */
export function shouldAnalyze(event: Pick<JobSettled, 'kind' | 'status' | 'songId'> | null, facts: SongFacts): boolean {
  if (event && (event.status !== 'done' || !event.songId || !AUDIO_KINDS.includes(event.kind))) return false;
  return facts.hasThread && facts.playable && !facts.analyzed && !facts.pending;
}

export function songFacts(songId: string): SongFacts {
  const hasThread = Boolean(db.prepare(`SELECT 1 FROM chat_threads WHERE song_id = ?`).get(songId));
  const take = hasThread ? playableVersion(songId) : null;
  return {
    hasThread, playable: take !== null,
    analyzed: take ? readVersionAnalysis(take.id) !== null : false,
    pending: take ? analysisPending(songId, take.id) : false,
  };
}

export interface TriggerDeps {
  facts: (songId: string) => SongFacts;
  start: (songId: string) => Job;
}
const defaults: TriggerDeps = { facts: songFacts, start: (songId) => startAnalysis(songId) };

function attempt(songId: string, event: JobSettled | null, deps: TriggerDeps): Job | null {
  try {
    return shouldAnalyze(event, deps.facts(songId)) ? deps.start(songId) : null;
  } catch (err) {
    console.error(`chat analysis of song ${songId} not queued:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** The thread GET's check; the job it queued, or null. */
export const ensureAnalysis = (songId: string, deps: TriggerDeps = defaults): Job | null => attempt(songId, null, deps);

/** Subscribes the trigger to every job's settle; returns the unsubscribe. */
export function startAnalysisTrigger(deps: TriggerDeps = defaults): () => void {
  return onJobSettled((event) => {
    if (event.songId) attempt(event.songId, event, deps);
  });
}
