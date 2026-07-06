/**
 * Stamps output-file metadata (artist/album/genre/encoder/cover art from Settings, plus
 * per-song title/bpm/key/comment) onto a generated audio file, and re-stamps it when a
 * song's fields change later (e.g. its comment). Uses node-taglib-sharp rather than an
 * ID3-only library since it's the only lightweight option that supports choosing the
 * ID3v2 tag version (2.3 vs 2.4) — node-id3/browser-id3-writer both hardcode v2.3.
 * No loudness normalization or other audio processing happens here — tags only.
 */
import path from 'node:path';
import { File, Id3v2Settings, Id3v2FrameIdentifiers, TagTypes, Picture, type Id3v2Tag } from 'node-taglib-sharp';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getOutputMetadata } from './outputMetadata.js';

export interface SongTagFields {
  title: string;
  bpm?: number | null;
  keyScale?: string;
  comment?: string;
}

/**
 * node-taglib-sharp can only embed an ID3v2 tag in a WAV/RIFF container using the v2.4
 * footer feature — asking for v2.3 on a .wav throws "Feature only supported in version
 * 2.4+" (verified empirically; not documented). MP3 correctly honors either version.
 */
function isWavFooterVersionError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Feature only supported in version 2.4+');
}

function writeTagsAtVersion(filePath: string, fields: SongTagFields, meta: ReturnType<typeof getOutputMetadata>, version: 3 | 4): void {
  Id3v2Settings.defaultVersion = version;
  Id3v2Settings.forceDefaultVersion = true;

  const file = File.createFromPath(filePath);
  try {
    file.tag.title = fields.title;
    if (meta.artist) file.tag.performers = [meta.artist];
    if (meta.album) file.tag.album = meta.album;
    if (meta.genre) file.tag.genres = [meta.genre];
    if (fields.comment) file.tag.comment = fields.comment;
    if (fields.bpm) file.tag.beatsPerMinute = fields.bpm;
    if (fields.keyScale) file.tag.initialKey = fields.keyScale;

    if (meta.coverArtFile) {
      try {
        file.tag.pictures = [Picture.fromPath(path.join(config.audioDir, meta.coverArtFile))];
      } catch { /* cover art missing on disk — tag without it */ }
    }

    // "Encoded by" (TENC) has no format-agnostic Tag property — set it on the
    // ID3v2-specific tag directly via its raw frame API.
    if (meta.encoder) {
      const id3 = file.getTag(TagTypes.Id3v2, true) as Id3v2Tag | undefined;
      id3?.setTextFrame(Id3v2FrameIdentifiers.TENC, meta.encoder);
    }

    file.save();
  } finally {
    file.dispose();
  }
}

/** Tags a single file. Failures are logged and swallowed — tagging must never break the
 * surrounding generation job. */
export async function tagOutputFile(filePath: string, fields: SongTagFields): Promise<void> {
  const meta = getOutputMetadata();
  const requestedVersion = meta.id3Version === '3' ? 3 : 4;
  try {
    writeTagsAtVersion(filePath, fields, meta, requestedVersion);
  } catch (err) {
    if (requestedVersion === 3 && isWavFooterVersionError(err)) {
      // This container (WAV) can only carry an ID3v2.4 tag — fall back rather than
      // leave the file completely untagged just because v2.3 was requested globally.
      try {
        writeTagsAtVersion(filePath, fields, meta, 4);
        console.warn(`tagOutputFile: ${filePath} requires ID3v2.4 (WAV container) — tagged as v2.4 instead of the configured v2.3`);
        return;
      } catch (fallbackErr) {
        err = fallbackErr;
      }
    }
    console.error(`tagOutputFile failed for ${filePath}:`, err instanceof Error ? err.message : err);
  }
}

interface SongRow {
  title: string;
  bpm: number | null;
  key_scale: string;
  comment: string;
}

/** Re-tags every layer's currently active version file for a song — used when a
 * song-level field (comment) changes after its files already exist. */
export async function retagSong(songId: string): Promise<void> {
  const song = db.prepare(`SELECT title, bpm, key_scale, comment FROM songs WHERE id = ?`).get(songId) as SongRow | undefined;
  if (!song) return;
  const versions = db
    .prepare(`SELECT v.audio_file FROM versions v JOIN layers l ON v.layer_id = l.id WHERE l.song_id = ? AND v.active = 1`)
    .all(songId) as Array<{ audio_file: string }>;
  for (const { audio_file } of versions) {
    await tagOutputFile(path.join(config.audioDir, audio_file), {
      title: song.title, bpm: song.bpm, keyScale: song.key_scale, comment: song.comment,
    });
  }
}
