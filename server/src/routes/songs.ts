import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { emptyTrashNow } from '../services/trashSweep.js';
import { retagSong } from '../services/fileTags.js';

export const songsRouter = Router();

const coverArtUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** List songs: favorites first, trashed excluded. ?q= searches title/caption/lyrics.
 * ?folder= scopes to one folder id, or the literal `unfiled` for songs with no folder;
 * omitted entirely shows all songs regardless of folder. */
songsRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const like = `%${q}%`;
  const folder = req.query.folder !== undefined ? String(req.query.folder) : null;
  const folderClause = folder === null ? '1 = 1' : folder === 'unfiled' ? 's.folder_id IS NULL' : 's.folder_id = ?';
  const folderParams = folder === null || folder === 'unfiled' ? [] : [folder];
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT v.audio_file FROM versions v
          JOIN layers l ON v.layer_id = l.id
          WHERE l.song_id = s.id AND l.kind = 'base' AND v.active = 1
          ORDER BY v.created_at DESC LIMIT 1) AS audio_file
       FROM songs s
       WHERE s.trashed_at IS NULL
         AND (? = '' OR s.title LIKE ? OR s.caption LIKE ? OR s.lyrics LIKE ?)
         AND ${folderClause}
       ORDER BY s.favorite DESC, s.created_at DESC`,
    )
    .all(q, like, like, like, ...folderParams);
  res.json(rows);
});

songsRouter.get('/trash', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM songs WHERE trashed_at IS NOT NULL ORDER BY trashed_at`).all());
});

/** Settings > Library Maintenance's "EMPTY TRASH NOW" — bypasses the 7-day sweep. */
songsRouter.delete('/trash', (_req, res) => {
  emptyTrashNow();
  res.json({ ok: true });
});

/** Library Maintenance stats for the Settings screen: disk usage + song/trash counts. */
songsRouter.get('/stats', async (_req, res) => {
  const { songCount } = db.prepare(`SELECT COUNT(*) AS songCount FROM songs WHERE trashed_at IS NULL`).get() as { songCount: number };
  const { trashCount } = db.prepare(`SELECT COUNT(*) AS trashCount FROM songs WHERE trashed_at IS NOT NULL`).get() as { trashCount: number };
  let storageBytes = 0;
  try {
    const files = await fs.readdir(config.audioDir);
    const sizes = await Promise.all(files.map((f) => fs.stat(path.join(config.audioDir, f)).then((s) => s.size).catch(() => 0)));
    storageBytes = sizes.reduce((a, b) => a + b, 0);
  } catch {
    storageBytes = 0;
  }
  res.json({ storageBytes, songCount, trashCount });
});

/** Full editor payload: song + layers + all versions per layer. */
songsRouter.get('/:id', (req, res) => {
  const song = db.prepare(`SELECT * FROM songs WHERE id = ?`).get(req.params.id);
  if (!song) return res.status(404).json({ error: 'unknown song' });
  const layers = db
    .prepare(`SELECT * FROM layers WHERE song_id = ? ORDER BY position`)
    .all(req.params.id) as Array<Record<string, unknown>>;
  for (const layer of layers) {
    const versions = db
      .prepare(`SELECT id, audio_file, label, params_json, seed, active, lyric_timestamps, created_at FROM versions
                WHERE layer_id = ? ORDER BY created_at DESC`)
      .all(layer.id as string) as Array<Record<string, unknown>>;
    layer.versions = versions.map(({ params_json, lyric_timestamps, ...rest }) => {
      const params = JSON.parse(params_json as string) as {
        prompt?: string; task_type?: string; repainting_start?: number; repainting_end?: number;
      };
      return {
        ...rest,
        prompt: params.prompt ?? '',
        task_type: params.task_type ?? 'text2music',
        region_start: params.repainting_start ?? null,
        region_end: params.repainting_end ?? null,
        lyricTimestamps: lyric_timestamps ? JSON.parse(lyric_timestamps as string) : null,
      };
    });
  }
  res.json({ ...song, layers });
});

songsRouter.patch('/:id/title', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'title required' });
  db.prepare(`UPDATE songs SET title = ? WHERE id = ?`).run(title, req.params.id);
  await retagSong(String(req.params.id));
  res.json({ ok: true });
});

/** Editable from the Library's song detail rail — feeds the COMM/TCON/TALB output-file tags. */
songsRouter.patch('/:id/metadata', async (req, res) => {
  const { genre, album, comment } = req.body ?? {};
  db.prepare(
    `UPDATE songs SET
       genre   = COALESCE(?, genre),
       album   = COALESCE(?, album),
       comment = COALESCE(?, comment)
     WHERE id = ?`,
  ).run(
    typeof genre === 'string' ? genre : null,
    typeof album === 'string' ? album : null,
    typeof comment === 'string' ? comment : null,
    req.params.id,
  );
  await retagSong(String(req.params.id));
  res.json({ ok: true });
});

/** Per-song cover art (APIC frame) — replaces any existing one for this song. */
songsRouter.post('/:id/cover-art', coverArtUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image is required' });
  const song = db.prepare(`SELECT cover_art_file FROM songs WHERE id = ?`).get(req.params.id) as { cover_art_file: string | null } | undefined;
  if (!song) return res.status(404).json({ error: 'unknown song' });
  if (song.cover_art_file) await fs.unlink(path.join(config.audioDir, song.cover_art_file)).catch(() => {});

  const ext = path.extname(req.file.originalname) || '.png';
  const filename = `${req.params.id}-cover${ext}`;
  await fs.writeFile(path.join(config.audioDir, filename), req.file.buffer);
  db.prepare(`UPDATE songs SET cover_art_file = ? WHERE id = ?`).run(filename, req.params.id);
  await retagSong(String(req.params.id));
  res.json({ coverArtFile: filename });
});

songsRouter.delete('/:id/cover-art', async (req, res) => {
  const song = db.prepare(`SELECT cover_art_file FROM songs WHERE id = ?`).get(req.params.id) as { cover_art_file: string | null } | undefined;
  if (!song) return res.status(404).json({ error: 'unknown song' });
  if (song.cover_art_file) await fs.unlink(path.join(config.audioDir, song.cover_art_file)).catch(() => {});
  db.prepare(`UPDATE songs SET cover_art_file = NULL WHERE id = ?`).run(req.params.id);
  await retagSong(String(req.params.id));
  res.json({ ok: true });
});

/** Files/refiles a song — `folder_id: null` (or omitted) moves it back to Unfiled. */
songsRouter.patch('/:id/folder', (req, res) => {
  const folderId = req.body?.folder_id ? String(req.body.folder_id) : null;
  db.prepare(`UPDATE songs SET folder_id = ? WHERE id = ?`).run(folderId, req.params.id);
  res.json({ ok: true });
});

songsRouter.patch('/:id/favorite', (req, res) => {
  const fav = req.body?.favorite ? 1 : 0;
  db.prepare(`UPDATE songs SET favorite = ? WHERE id = ?`).run(fav, req.params.id);
  res.json({ ok: true });
});

/** Dislike -> move to trash (deleted by sweep after 7 days). */
songsRouter.patch('/:id/trash', (req, res) => {
  const restore = req.body?.restore === true;
  db.prepare(`UPDATE songs SET trashed_at = ? WHERE id = ?`).run(
    restore ? null : new Date().toISOString(),
    req.params.id,
  );
  res.json({ ok: true });
});
