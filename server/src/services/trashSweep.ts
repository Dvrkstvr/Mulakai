/** Permanently delete songs trashed more than 7 days ago, including their audio files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';

const TRASH_TTL_DAYS = 7;

function deleteSongsPermanently(ids: string[]): void {
  for (const id of ids) {
    const files = db
      .prepare(
        `SELECT v.audio_file FROM versions v JOIN layers l ON v.layer_id = l.id WHERE l.song_id = ?`,
      )
      .all(id)
      .map((r) => (r as { audio_file: string }).audio_file);
    const song = db.prepare(`SELECT cover_art_file FROM songs WHERE id = ?`).get(id) as
      | { cover_art_file: string | null }
      | undefined;
    if (song?.cover_art_file) files.push(song.cover_art_file);
    db.prepare(`DELETE FROM songs WHERE id = ?`).run(id); // cascades to layers/versions
    for (const file of files) {
      // catch: `force` only swallows ENOENT — an in-use file (Windows EBUSY, e.g. still
      // streaming to the player) would otherwise be an unhandled rejection.
      void fs.rm(path.join(config.audioDir, file), { force: true }).catch(() => {});
    }
  }
}

export function sweepTrash(): void {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const expired = db
    .prepare(`SELECT id FROM songs WHERE trashed_at IS NOT NULL AND trashed_at < ?`)
    .all(cutoff) as Array<{ id: string }>;
  deleteSongsPermanently(expired.map((r) => r.id));
}

/** Settings > Library Maintenance's "EMPTY TRASH NOW" — deletes every currently trashed
 * song immediately, regardless of the 7-day TTL. */
export function emptyTrashNow(): void {
  const trashed = db.prepare(`SELECT id FROM songs WHERE trashed_at IS NOT NULL`).all() as Array<{ id: string }>;
  deleteSongsPermanently(trashed.map((r) => r.id));
}
