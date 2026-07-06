/** Settings > Output File Metadata: server-side (not client-persisted) since it's a
 * property of the generated files themselves, needed wherever a job writes one, not a
 * per-browser generation preference like the client-persisted settings.ts store. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';

export interface OutputMetadata {
  artist: string;
  encoder: string;
  album: string;
  genre: string;
  coverArtFile: string | null;
  id3Version: '3' | '4';
}

interface Row {
  artist: string;
  encoder: string;
  album: string;
  genre: string;
  cover_art_file: string | null;
  id3_version: string;
}

export function getOutputMetadata(): OutputMetadata {
  const row = db
    .prepare(`SELECT artist, encoder, album, genre, cover_art_file, id3_version FROM output_metadata WHERE id = 1`)
    .get() as Row;
  return {
    artist: row.artist,
    encoder: row.encoder,
    album: row.album,
    genre: row.genre,
    coverArtFile: row.cover_art_file,
    id3Version: row.id3_version === '3' ? '3' : '4',
  };
}

export function updateOutputMetadata(
  patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'album' | 'genre' | 'id3Version'>>,
): OutputMetadata {
  const next = { ...getOutputMetadata(), ...patch };
  db.prepare(`UPDATE output_metadata SET artist = ?, encoder = ?, album = ?, genre = ?, id3_version = ? WHERE id = 1`)
    .run(next.artist, next.encoder, next.album, next.genre, next.id3Version);
  return getOutputMetadata();
}

/** Replaces the default cover art embedded in every tagged output file. */
export async function setCoverArt(buffer: Buffer, ext: string): Promise<OutputMetadata> {
  const current = getOutputMetadata();
  if (current.coverArtFile) await fs.unlink(path.join(config.audioDir, current.coverArtFile)).catch(() => {});
  const filename = `_cover-art${ext}`;
  await fs.writeFile(path.join(config.audioDir, filename), buffer);
  db.prepare(`UPDATE output_metadata SET cover_art_file = ? WHERE id = 1`).run(filename);
  return getOutputMetadata();
}

export async function clearCoverArt(): Promise<OutputMetadata> {
  const current = getOutputMetadata();
  if (current.coverArtFile) await fs.unlink(path.join(config.audioDir, current.coverArtFile)).catch(() => {});
  db.prepare(`UPDATE output_metadata SET cover_art_file = NULL WHERE id = 1`).run();
  return getOutputMetadata();
}
