import { Router } from 'express';
import { db } from '../db/index.js';

export const songsRouter = Router();

/** List songs: favorites first, trashed excluded. ?q= searches title/caption/lyrics. */
songsRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT v.audio_file FROM versions v
          JOIN layers l ON v.layer_id = l.id
          WHERE l.song_id = s.id AND l.kind = 'base' AND v.active = 1
          ORDER BY v.created_at DESC LIMIT 1) AS audio_file
       FROM songs s
       WHERE s.trashed_at IS NULL
         AND (? = '' OR s.title LIKE ? OR s.caption LIKE ? OR s.lyrics LIKE ?)
       ORDER BY s.favorite DESC, s.created_at DESC`,
    )
    .all(q, like, like, like);
  res.json(rows);
});

songsRouter.get('/trash', (_req, res) => {
  res.json(db.prepare(`SELECT * FROM songs WHERE trashed_at IS NOT NULL ORDER BY trashed_at`).all());
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
