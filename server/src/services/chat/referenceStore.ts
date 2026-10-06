/**
 * Reference rows and their files (F-061 storage, F-062, D-127, D-137, docs/decisions/0008): a copy
 * of the audio in `audioDir/references/<id>.<ext>` per `chat_references` row of a thread. An upload
 * is checked (referenceRules) after a probe of the written file; a library pick copies its base
 * layer's active take and snapshots the song's own data (`own_v: 1`). Each copy is written, probed
 * and inserted synchronously, so `sweepFiles` (orphans by id) never sees a file before its row.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { readAudioDuration } from '../fileTags.js';
import { loadScoreSource } from '../score/scoreSource.js';
import type { ReferenceView } from './chatTypes.js';
import { readReading, type Reading } from './reading.js';
import { readSpan, referenceExt, uploadProblem } from './referenceRules.js';

export const OWN_V = 1;
/** A library song's own data at the pick (`own_json`); `layers` > 1 → only the base was read (D-137). */
export interface OwnSnapshot {
  own_v: 1; abc: string | null; lyrics: string | null; caption: string | null;
  bpm: number | null; key: string | null; meter: string | null; engine: string | null; layers: number;
}
export interface Reference {
  id: string; threadId: string; origin: 'upload' | 'library'; name: string; sourceSongId: string | null;
  /** `references/<id>.<ext>`, relative to audioDir. */
  file: string; bytes: number; sha256: string; seconds: number | null;
  own: OwnSnapshot | null; reading: Reading | null; readingNote: string | null; createdAt: string;
}
export type AddResult = { ok: true; reference: Reference; existing: boolean } | { ok: false; reason: string };

interface Row {
  id: string; thread_id: string; origin: string; name: string; source_song_id: string | null; file: string;
  bytes: number; sha256: string; seconds: number | null; own_json: string | null; reading_json: string | null; created_at: string;
}

const NAME_MAX = 200;
const DIR = 'references';
const dirPath = () => path.join(config.audioDir, DIR);

function readOwn(raw: string | null): OwnSnapshot | null {
  try {
    const o = raw ? (JSON.parse(raw) as OwnSnapshot) : null;
    return o && o.own_v === OWN_V ? o : null;
  } catch {
    return null;
  }
}

function decode(r: Row): Reference {
  const { reading, note } = readReading(r.reading_json);
  return {
    id: r.id, threadId: r.thread_id, origin: r.origin === 'library' ? 'library' : 'upload', name: r.name,
    sourceSongId: r.source_song_id, file: r.file, bytes: r.bytes, sha256: r.sha256, seconds: r.seconds,
    own: readOwn(r.own_json), reading, readingNote: note, createdAt: r.created_at,
  };
}

export function getReference(id: string): Reference | null {
  const row = db.prepare(`SELECT * FROM chat_references WHERE id = ?`).get(id) as Row | undefined;
  return row ? decode(row) : null;
}

export const listReferences = (threadId: string): Reference[] =>
  (db.prepare(`SELECT * FROM chat_references WHERE thread_id = ? ORDER BY created_at, rowid`).all(threadId) as Row[]).map(decode);

const sameFile = (threadId: string, sha256: string) =>
  db.prepare(`SELECT * FROM chat_references WHERE thread_id = ? AND sha256 = ?`).get(threadId, sha256) as Row | undefined;

/** Write the copy, probe it, insert the row; a failed check removes the file. Synchronous throughout. */
function store(threadId: string, data: Buffer, ext: string, row: { origin: string; name: string; sourceSongId: string | null; own: OwnSnapshot | null },
  check: (seconds: number | null) => string | null): AddResult {
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const existing = sameFile(threadId, sha256);
  if (existing) return { ok: true, reference: decode(existing), existing: true };
  const id = crypto.randomUUID();
  const file = `${DIR}/${id}.${ext}`;
  const abs = path.join(config.audioDir, file);
  fs.mkdirSync(dirPath(), { recursive: true });
  fs.writeFileSync(abs, data);
  const seconds = readAudioDuration(abs);
  const problem = check(seconds);
  if (problem) {
    fs.rmSync(abs, { force: true });
    return { ok: false, reason: problem };
  }
  db.prepare(`INSERT INTO chat_references (id, thread_id, origin, name, source_song_id, file, bytes, sha256, seconds, own_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, threadId, row.origin, row.name.slice(0, NAME_MAX), row.sourceSongId, file, data.length, sha256, seconds, row.own ? JSON.stringify(row.own) : null);
  return { ok: true, reference: getReference(id)!, existing: false };
}

/** A dropped or picked file. Refused (nothing stored) unless it reads as audio (referenceRules). */
export function fromUpload(threadId: string, upload: { data: Buffer; filename: string }): AddResult {
  const filename = upload.filename.trim() || 'reference';
  const early = uploadProblem({ filename, bytes: upload.data.length, seconds: 1, maxMb: config.coverMaxUploadMb });
  if (early) return { ok: false, reason: early };
  const check = (seconds: number | null) => uploadProblem({ filename, bytes: upload.data.length, seconds, maxMb: config.coverMaxUploadMb });
  return store(threadId, upload.data, referenceExt(filename)!, { origin: 'upload', name: filename, sourceSongId: null, own: null }, check);
}

interface SongRow { title: string; caption: string; lyrics: string; bpm: number | null; key_scale: string; time_signature: string; duration: number | null; engine: string | null }

/** A library song: its base layer's active take (D-137), copied, with its own data snapshotted. */
export async function fromLibrary(threadId: string, songId: string): Promise<AddResult> {
  const song = db.prepare(`SELECT title, caption, lyrics, bpm, key_scale, time_signature, duration, engine FROM songs WHERE id = ? AND trashed_at IS NULL`)
    .get(songId) as SongRow | undefined;
  const src = song ? await loadScoreSource(songId) : null;
  if (!song || !src) return { ok: false, reason: 'that song is not in the library' };
  const take = src.activeVersionId
    ? db.prepare(`SELECT audio_file FROM versions WHERE id = ?`).get(src.activeVersionId) as { audio_file: string } | undefined
    : undefined;
  const takePath = take ? path.join(config.audioDir, take.audio_file) : '';
  if (!take || !fs.existsSync(takePath)) return { ok: false, reason: `${song.title} has no take to read` };
  const own: OwnSnapshot = {
    own_v: OWN_V, abc: src.abc, lyrics: src.lyrics ?? (song.lyrics || null), caption: song.caption || null,
    bpm: song.bpm, key: song.key_scale || null, meter: song.time_signature || null, engine: song.engine, layers: src.layerCount,
  };
  const ext = referenceExt(take.audio_file) ?? 'wav';
  const fallback = song.duration;
  const result = store(threadId, fs.readFileSync(takePath), ext, { origin: 'library', name: song.title, sourceSongId: songId, own },
    (seconds) => (seconds ?? fallback) ? null : `${song.title}'s take could not be read as audio`);
  if (result.ok && result.reference.seconds === null && fallback) {
    db.prepare(`UPDATE chat_references SET seconds = ? WHERE id = ?`).run(fallback, result.reference.id);
    return { ...result, reference: getReference(result.reference.id)! };
  }
  return result;
}

/** The latest reading replaces the previous one (RE-ANALYZE). False when the row is gone. */
export const setReading = (id: string, reading: Reading): boolean =>
  db.prepare(`UPDATE chat_references SET reading_json = ? WHERE id = ?`).run(JSON.stringify(reading), id).changes > 0;

export function toView(r: Reference): ReferenceView {
  const span = readSpan(r.seconds);
  return {
    id: r.id, origin: r.origin, name: r.name, sourceSongId: r.sourceSongId, url: `/audio/${r.file}`, seconds: r.seconds,
    readTo: span.to, cut: span.cut, layers: r.own?.layers ?? null, readAt: r.reading?.readAt ?? null,
    readingNote: r.readingNote, createdAt: r.createdAt,
  };
}

/** Delete every file in audioDir/references whose id (name before the extension) has no row:
 * after NEW CHAT, a permanent delete (trashSweep) and at start. Returns how many went. */
export async function sweepFiles(): Promise<number> {
  let names: string[];
  try {
    names = await fs.promises.readdir(dirPath());
  } catch {
    return 0;
  }
  const has = db.prepare(`SELECT 1 FROM chat_references WHERE id = ?`);
  let removed = 0;
  for (const name of names) {
    if (has.get(name.replace(/\.[^.]*$/, ''))) continue;
    // catch: an in-use file (Windows EBUSY, still streaming to the player) stays for the next sweep.
    await fs.promises.rm(path.join(dirPath(), name), { force: true, recursive: true }).then(() => { removed += 1; }, () => {});
  }
  return removed;
}
