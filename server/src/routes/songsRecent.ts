import { Router } from 'express';
import { db } from '../db/index.js';

export const songsRecentRouter = Router();

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 20;

/** Library's CONTINUE row (PLAN.md "UI Redesign", S3.6): non-trashed songs ordered by their
 * newest version, since `songs` has no `updated_at` and versions are the edits. Each row names
 * that version's layer, label and time, plus how many takes the layer has (the version badge). */
songsRecentRouter.get('/recent', (req, res) => {
  const asked = Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(asked) ? Math.min(MAX_LIMIT, Math.max(1, asked)) : DEFAULT_LIMIT;
  // created_at has one-second resolution; rowid breaks ties in insertion order.
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.duration,
          (SELECT bv.audio_file FROM versions bv JOIN layers bl ON bv.layer_id = bl.id
            WHERE bl.song_id = s.id AND bl.kind = 'base' AND bv.active = 1
            ORDER BY bv.created_at DESC LIMIT 1) AS audio_file,
          v.label AS version_label, v.created_at AS edited_at,
          l.name AS layer_name, l.kind AS layer_kind,
          (SELECT COUNT(*) FROM versions cv WHERE cv.layer_id = l.id) AS layer_versions
       FROM songs s
       JOIN versions v ON v.id = (
         SELECT nv.id FROM versions nv JOIN layers nl ON nv.layer_id = nl.id
          WHERE nl.song_id = s.id ORDER BY nv.created_at DESC, nv.rowid DESC LIMIT 1)
       JOIN layers l ON l.id = v.layer_id
       WHERE s.trashed_at IS NULL
       ORDER BY v.created_at DESC, v.rowid DESC
       LIMIT ?`,
    )
    .all(limit);
  res.json(rows);
});
