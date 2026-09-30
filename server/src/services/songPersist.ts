/**
 * The shared tail of every song-creating job: transcode the lossless master into
 * the user's format, tag it, and insert the song -> Base layer -> first version rows.
 * Callers own getting the audio and its metadata (ACE-Step's persistSong in jobs.ts
 * downloads + aligns lyrics first; engineGenJobs.ts fetches from an extra engine).
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { parseOutputSettings, outputExt } from './audioOutput.js';
import { transcodeBuffer } from './transcode.js';
import { tagOutputFile, readAudioDuration } from './fileTags.js';
import { writeScoreSidecar } from './versionFiles.js';
import type { EngineId } from './engines/types.js';

/** What reference audio (if any) conditioned a generation, persisted onto the song for the
 * Library detail rail. Influences are null for cover/complete, which don't remap them, and
 * audioInfluence is also null for text2music (see jobs.ts's startGeneration). */
export interface ReferenceAudioMeta {
  label: string;
  audioInfluence: number | null;
  styleInfluence: number | null;
}

/** The song-row fields a generator reports about its own output. */
export interface GeneratedSongMeta {
  caption: string;
  lyrics: string;
  bpm: number | null;
  keyScale: string;
  timeSignature: string;
  /** Null = read it back from the transcoded file (extra engines report none). */
  duration: number | null;
  seed: string;
}

export interface GeneratedSong {
  /** Lossless master; `params.output` decides what lands on disk. */
  audio: Buffer;
  meta: GeneratedSongMeta;
  /** Recorded verbatim as the first version's params_json; `task_type` becomes songs.gen_task. */
  params: { output?: unknown; task_type?: string };
  lyricTimestamps: string | null;
  title: string;
  folderId?: string | null;
  referenceMeta?: ReferenceAudioMeta | null;
  /** The extra engine that made this take; null/absent = ACE-Step. */
  engine?: EngineId | null;
  /** Defaults to 'first generation'. */
  label?: string;
  /** An engine's ABC score, kept as the version's sidecar (see versionFiles.ts). */
  score?: string | null;
}

/** Insert a brand-new song with a single base layer/version. Returns the song id. */
export async function insertGeneratedSong(song: GeneratedSong): Promise<string> {
  const { meta, params, referenceMeta } = song;
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  // The generator hands back a lossless master; the user's format/rate/depth is
  // applied here, once, on the way into audioDir (see transcode.ts).
  const out = parseOutputSettings(params.output);
  const filename = `${versionId}.${outputExt(out)}`;
  const filePath = path.join(config.audioDir, filename);
  await transcodeBuffer(song.audio, filePath, out);
  await tagOutputFile(filePath, { title: song.title, bpm: meta.bpm, keyScale: meta.keyScale });
  const duration = meta.duration ?? readAudioDuration(filePath);
  // Nothing reads the score yet and it can't be recovered later, but it is never worth
  // failing a finished song over.
  if (song.score) await writeScoreSidecar(versionId, song.score).catch(() => {});

  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration, folder_id,
                        reference_audio_label, reference_audio_influence, reference_style_influence, gen_task, engine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    songId, song.title, meta.caption, meta.lyrics,
    meta.bpm, meta.keyScale, meta.timeSignature, duration,
    song.folderId ?? null,
    referenceMeta?.label ?? null, referenceMeta?.audioInfluence ?? null, referenceMeta?.styleInfluence ?? null,
    params.task_type ?? null, song.engine ?? null,
  );
  db.prepare(
    `INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`,
  ).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, lyric_timestamps)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(versionId, layerId, filename, song.label ?? 'first generation', JSON.stringify(params), meta.seed, song.lyricTimestamps);

  return songId;
}
