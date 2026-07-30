/**
 * Import an existing audio file as a song, so it can be repainted/layered like a
 * generated one (see PLAN.md's "Import a Song"). This is the only song-creation path
 * that doesn't come from a task result — `persistSong()` (services/jobs.ts) starts
 * from `downloadAudio(result.file)` and can't be reused — but it produces the exact
 * same shape: one song, one `base` layer, one active version. No genLock is taken:
 * nothing is generated, so an import must neither contend with nor wait on ACE-Step.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { tagOutputFile } from '../services/fileTags.js';

export const songImportRouter = Router();

// Same 100MB ceiling generate.ts uses for source audio — a full-length lossless track.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/**
 * `/audio` is served by express.static and the stored filename ends in whatever the
 * upload claimed, so an `.html`/`.svg` upload would be served from the app's own
 * origin. Allowlist rather than denylist.
 */
const ALLOWED_EXTS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.opus'];

/** Optional numeric form field — absent, blank and unparseable all mean "unknown". */
function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

songImportRouter.post('/import', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio is required' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return res.status(400).json({ error: `unsupported audio format "${ext || req.file.originalname}"` });
  }

  const folderId = req.body?.folder_id ? String(req.body.folder_id) : null;
  if (folderId && !db.prepare(`SELECT id FROM folders WHERE id = ?`).get(folderId)) {
    return res.status(400).json({ error: 'unknown folder' });
  }

  // Falls back to the filename so a drag-and-drop import never needs a title typed
  // first; `Untitled` only if that leaves nothing (a filename that is whitespace plus
  // an extension). Note a dotfile-style name like ".mp3" never reaches here — Node reads
  // it as a hidden file with no extension, so the allowlist above rejects it.
  const title = str(req.body?.title).trim()
    || path.basename(req.file.originalname, path.extname(req.file.originalname)).trim()
    || 'Untitled';

  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = `${versionId}${ext}`;
  const bpm = num(req.body?.bpm);
  const keyScale = str(req.body?.key_scale);

  await fs.writeFile(path.join(config.audioDir, filename), req.file.buffer);
  await tagOutputFile(path.join(config.audioDir, filename), { title, bpm, keyScale });

  // `task_type: 'import'` in params_json (not `{}`) is what tells the rest of the app
  // this version can't be replayed — routes/songs.ts surfaces it per version and
  // repaintJobs.ts refuses ALT/SIMILAR on it.
  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, duration, folder_id, gen_task)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'import')`,
  ).run(
    songId, title, str(req.body?.prompt), str(req.body?.lyrics),
    bpm, keyScale, num(req.body?.duration), folderId,
  );
  db.prepare(
    `INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`,
  ).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed)
     VALUES (?, ?, ?, 'imported', '{"task_type":"import"}', '')`,
  ).run(versionId, layerId, filename);

  const song = db.prepare(`SELECT * FROM songs WHERE id = ?`).get(songId) as Record<string, unknown>;
  res.status(201).json({ ...song, audio_file: filename });
});
