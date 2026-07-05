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
