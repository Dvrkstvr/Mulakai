import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from '../db/index.js';

export const foldersRouter = Router();

/** Escapes regex metacharacters so a folder name can be safely dropped into a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

foldersRouter.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT f.*, (SELECT COUNT(*) FROM songs s WHERE s.folder_id = f.id AND s.trashed_at IS NULL) AS song_count
       FROM folders f ORDER BY f.position, f.created_at`,
    )
    .all();
  res.json(rows);
});

foldersRouter.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = crypto.randomUUID();
  const { maxPosition } = db.prepare(`SELECT MAX(position) AS maxPosition FROM folders`).get() as { maxPosition: number | null };
  db.prepare(`INSERT INTO folders (id, name, position) VALUES (?, ?, ?)`).run(id, name, (maxPosition ?? -1) + 1);
  res.status(201).json(db.prepare(`SELECT *, 0 AS song_count FROM folders WHERE id = ?`).get(id));
});

foldersRouter.patch('/:id', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare(`UPDATE folders SET name = ? WHERE id = ?`).run(name, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'unknown folder' });
  res.json({ ok: true });
});

/** Deletes the folder only — songs inside it fall back to unfiled (folder_id -> NULL) via
 * the column's ON DELETE SET NULL, never deleted themselves. */
foldersRouter.delete('/:id', (req, res) => {
  const result = db.prepare(`DELETE FROM folders WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'unknown folder' });
  res.json({ ok: true });
});

/**
 * The default title a new song in this folder should start with — the folder's own name
 * for the first song, then "<Name> <n>" incrementing past the highest number already used
 * (not just a count, so it keeps climbing even if an earlier song was deleted/retitled).
 */
foldersRouter.get('/:id/next-title', (req, res) => {
  const folder = db.prepare(`SELECT name FROM folders WHERE id = ?`).get(req.params.id) as { name: string } | undefined;
  if (!folder) return res.status(404).json({ error: 'unknown folder' });
  const rows = db
    .prepare(`SELECT title FROM songs WHERE folder_id = ? AND trashed_at IS NULL`)
    .all(req.params.id) as Array<{ title: string }>;
  if (rows.length === 0) return res.json({ title: folder.name });
  const numberedPattern = new RegExp(`^${escapeRegExp(folder.name)} (\\d+)$`);
  let maxN = 0;
  for (const { title } of rows) {
    if (title.trim() === folder.name) maxN = Math.max(maxN, 1);
    else {
      const match = title.trim().match(numberedPattern);
      if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
    }
  }
  res.json({ title: `${folder.name} ${maxN + 1}` });
});
