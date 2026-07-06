/** Settings > Output File Metadata: server-side (not client-persisted) since it's a
 * property of the generated files themselves, needed wherever a job writes one, not a
 * per-browser generation preference like the client-persisted settings.ts store.
 * Album/genre/cover-art moved to being per-song (see routes/songs.ts + fileTags.ts) —
 * only artist/encoder/ID3 version are global defaults now. */
import { db } from '../db/index.js';

export interface OutputMetadata {
  artist: string;
  encoder: string;
  id3Version: '3' | '4';
}

interface Row {
  artist: string;
  encoder: string;
  id3_version: string;
}

export function getOutputMetadata(): OutputMetadata {
  const row = db.prepare(`SELECT artist, encoder, id3_version FROM output_metadata WHERE id = 1`).get() as Row;
  return {
    artist: row.artist,
    encoder: row.encoder,
    id3Version: row.id3_version === '3' ? '3' : '4',
  };
}

export function updateOutputMetadata(patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'id3Version'>>): OutputMetadata {
  const next = { ...getOutputMetadata(), ...patch };
  db.prepare(`UPDATE output_metadata SET artist = ?, encoder = ?, id3_version = ? WHERE id = 1`)
    .run(next.artist, next.encoder, next.id3Version);
  return getOutputMetadata();
}
