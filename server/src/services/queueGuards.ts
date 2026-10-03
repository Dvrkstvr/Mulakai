/**
 * Run-time checks for a queued job (PLAN.md "UI Redesign", S4 decision 5): a job may wait
 * minutes in genQueue.ts, so what it works on is read again when it starts. A layer,
 * version or song deleted or trashed meanwhile fails the job with that reason, and a
 * queued edit reads its layer's audio *then*, so a second repaint chains onto the first.
 */
import { db } from '../db/index.js';

export const SONG_DELETED = 'the song was deleted while this job waited';
export const SONG_TRASHED = 'the song was moved to trash';
export const LAYER_DELETED = 'the layer was deleted while this job waited';
export const VERSION_DELETED = 'the version was deleted while this job waited';

/** Throws when the song is gone or in the trash. */
export function assertSongLive(songId: string): void {
  const row = db.prepare(`SELECT trashed_at FROM songs WHERE id = ?`).get(songId) as { trashed_at: string | null } | undefined;
  if (!row) throw new Error(SONG_DELETED);
  if (row.trashed_at) throw new Error(SONG_TRASHED);
}

/** The layer's active audio and song, for an edit that reads it. `missing` is the error when
 * there is none: 'unknown layer' when validating a request, LAYER_DELETED once queued. */
export function activeLayerSource(layerId: string, missing = LAYER_DELETED): { audio_file: string; song_id: string } {
  const row = db
    .prepare(
      `SELECT v.audio_file, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE l.id = ? AND v.active = 1`,
    )
    .get(layerId) as { audio_file: string; song_id: string } | undefined;
  if (!row) throw new Error(missing);
  assertSongLive(row.song_id);
  return row;
}

/** A layer's name, for Activity's UP NEXT row. */
export function layerName(layerId: string): string | undefined {
  return (db.prepare(`SELECT name FROM layers WHERE id = ?`).get(layerId) as { name: string } | undefined)?.name;
}

export function songTitle(songId: string): string | undefined {
  return (db.prepare(`SELECT title FROM songs WHERE id = ?`).get(songId) as { title: string } | undefined)?.title;
}

/** Throws when the version is gone, or its song is. */
export function assertVersionLive(versionId: string, missing = VERSION_DELETED): void {
  const row = db
    .prepare(`SELECT l.song_id FROM versions v JOIN layers l ON l.id = v.layer_id WHERE v.id = ?`)
    .get(versionId) as { song_id: string } | undefined;
  if (!row) throw new Error(missing);
  assertSongLive(row.song_id);
}
