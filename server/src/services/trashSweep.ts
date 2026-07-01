/** Permanently delete songs trashed more than 7 days ago, including their audio files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';

const TRASH_TTL_DAYS = 7;

export function sweepTrash(): void {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const expired = db
    .prepare(`SELECT id FROM songs WHERE trashed_at IS NOT NULL AND trashed_at < ?`)
    .all(cutoff) as Array<{ id: string }>;

  for (const { id } of expired) {
    const files = db
      .prepare(
        `SELECT v.audio_file FROM versions v JOIN layers l ON v.layer_id = l.id WHERE l.song_id = ?`,
      )
      .all(id) as Array<{ audio_file: string }>;
    db.prepare(`DELETE FROM songs WHERE id = ?`).run(id); // cascades to layers/versions
    for (const { audio_file } of files) {
      void fs.rm(path.join(config.audioDir, audio_file), { force: true });
    }
  }
}
