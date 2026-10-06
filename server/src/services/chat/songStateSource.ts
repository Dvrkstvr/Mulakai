/**
 * Gathers what a turn's song-state block needs (songState.ts): library titles, and for a song thread
 * its title, base versions with labels and yue-server's read of the active score (scoreStatus: the
 * sidecar + `/v1/scores/read`), or why the score cannot be read. The draft thread needs only the
 * library and its draft.
 */
import { db } from '../../db/index.js';
import { scoreStatus, type ScoreStatus } from '../score/scoreStatus.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { LIBRARY_MAX, songStateLines, type SongInput, type VersionLine } from './songState.js';
import type { TurnState } from './turnActions.js';
import type { ChatThread } from './chatTypes.js';

export interface SourceDeps { status: (songId: string) => Promise<ScoreStatus> }
export const sourceDeps = (over: Partial<SourceDeps> = {}): SourceDeps => ({ status: (songId) => scoreStatus(songId), ...over });

export interface GatheredState {
  block: string[];
  facts: ScoreFacts | null;
  state: TurnState;
  /** Why the song's score cannot be read; null on the draft thread or when it was read. */
  scoreReason: string | null;
}

export function libraryTitles(): string[] {
  return (db.prepare(`SELECT title FROM songs WHERE trashed_at IS NULL ORDER BY created_at DESC LIMIT ?`).all(LIBRARY_MAX) as Array<{ title: string }>)
    .map((r) => r.title);
}

/** The base layer's versions in the order they were made, numbered from 1. */
export function baseVersions(songId: string): Array<VersionLine & { id: string }> {
  const rows = db.prepare(`SELECT v.id, v.label, v.active FROM versions v JOIN layers l ON l.id = v.layer_id
    WHERE l.song_id = ? AND l.kind = 'base' ORDER BY v.created_at, v.rowid`).all(songId) as Array<{ id: string; label: string; active: number }>;
  return rows.map((r, i) => ({ id: r.id, number: i + 1, label: r.label || (i === 0 ? 'first take' : 'version'), active: r.active === 1 }));
}

function unreadable(s: ScoreStatus): string {
  const e = s.eligibility;
  if ('reason' in e) return e.reason;
  if (e.state === 'hidden') return 'this song was not made by YuE2 or SCORE is not set up, so there is no score to read';
  return s.read?.error ?? 'yue-server did not return the score facts';
}

export async function gatherTurnState(thread: ChatThread, deps: SourceDeps = sourceDeps()): Promise<GatheredState> {
  const library = libraryTitles();
  if (!thread.songId) {
    return { block: songStateLines({ library, draft: thread.draft.fields, song: null }), facts: null, state: { hasSong: false, scoreReadable: false }, scoreReason: null };
  }
  const row = db.prepare(`SELECT title, caption FROM songs WHERE id = ?`).get(thread.songId) as { title: string; caption: string } | undefined;
  let status: ScoreStatus | null = null;
  let reason: string | null = null;
  try {
    status = await deps.status(thread.songId);
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  const facts = (status?.read?.ok && status.read.facts ? status.read.facts : null) as ScoreFacts | null;
  if (!facts && status) reason = unreadable(status);
  const song: SongInput = {
    title: row?.title ?? 'Untitled', style: status?.source?.style ?? row?.caption ?? '',
    versions: baseVersions(thread.songId), facts, reason: facts ? null : reason,
  };
  return { block: songStateLines({ library, draft: thread.draft.fields, song }), facts, state: { hasSong: true, scoreReadable: Boolean(facts) }, scoreReason: song.reason };
}
