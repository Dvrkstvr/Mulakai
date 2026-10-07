/** Labelling and storing a repaint/regenerate/similar-take result as a layer version. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { downloadAudio, audioFileExt, type ReleaseTaskParams, type TaskResult } from './acestep.js';
import { fetchLyricTimestampsJson } from './jobs.js';
import { tagOutputFile } from './fileTags.js';

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

export function repaintLabel(prefix: string, params: ReleaseTaskParams): string {
  return `${prefix} ${fmtTime(params.repainting_start ?? 0)}–${
    params.repainting_end && params.repainting_end > 0 ? fmtTime(params.repainting_end) : 'end'}`;
}

/** Store a repaint/regenerate result as a version. `activate` (default true) makes it the layer's current version.
 * `basedOn`: the version whose audio the job edited (the layer's active one when it started), stored in
 * `params_json` only, never sent to ACE-Step: the chat's lineage reads it (analysisStore, D-180). */
export async function persistVersion(
  layerId: string,
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  label: string,
  activate = true,
  basedOn?: string,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.${audioFileExt(params.audio_format)}`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  const row = db.prepare(`SELECT song_id, kind FROM layers WHERE id = ?`).get(layerId) as { song_id: string; kind: string };
  const song = db.prepare(`SELECT title, bpm, key_scale, genre, album, cover_art_file FROM songs WHERE id = ?`).get(row.song_id) as
    { title: string; bpm: number | null; key_scale: string; genre: string; album: string; cover_art_file: string | null } | undefined;
  if (song) {
    await tagOutputFile(path.join(config.audioDir, filename), {
      title: song.title, bpm: song.bpm, keyScale: song.key_scale,
      genre: song.genre, album: song.album, coverArtFile: song.cover_art_file,
    });
  }

  if (activate) db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active, lyric_timestamps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(versionId, layerId, filename, label, JSON.stringify(basedOn ? { ...params, basedOn } : params), result.seed_value, activate ? 1 : 0, lyricTimestamps);

  // A repaint that edited lyrics for the base layer becomes the song's canonical
  // lyrics going forward (search, section-strip alignment, future repaints) —
  // only when this version actually becomes active; regenerate/similar-take
  // append history without activating and shouldn't touch canonical lyrics.
  // Each version's own params_json still retains the lyrics it was rendered
  // with, so reverting to an older version (see versions.ts) restores it too.
  if (activate && row.kind === 'base' && typeof params.lyrics === 'string' && params.lyrics.trim()) {
    db.prepare(`UPDATE songs SET lyrics = ? WHERE id = ?`).run(params.lyrics, row.song_id);
  }

  return row.song_id;
}
