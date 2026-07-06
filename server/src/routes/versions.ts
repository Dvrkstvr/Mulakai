import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { startRegenerate, startSimilarTake } from '../services/repaintJobs.js';

export const versionsRouter = Router();

/**
 * Make an older version the active one (revert). For the base layer, also
 * restores the song's canonical lyrics to whatever this version was rendered
 * with (stored in its params_json since generation/repaint always send it) —
 * audio and lyrics move together on revert, mirroring how repaint updates
 * both together (see repaintJobs.ts's persistVersion).
 */
versionsRouter.patch('/versions/:versionId/activate', (req, res) => {
  const version = db
    .prepare(
      `SELECT v.id, v.layer_id, v.params_json, l.kind, l.song_id FROM versions v
       JOIN layers l ON v.layer_id = l.id
       WHERE v.id = ?`,
    )
    .get(req.params.versionId) as
    { id: string; layer_id: string; params_json: string; kind: string; song_id: string } | undefined;
  if (!version) return res.status(404).json({ error: 'unknown version' });
  db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(version.layer_id);
  db.prepare(`UPDATE versions SET active = 1 WHERE id = ?`).run(version.id);

  if (version.kind === 'base') {
    const params = JSON.parse(version.params_json) as { lyrics?: string };
    if (typeof params.lyrics === 'string' && params.lyrics.trim()) {
      db.prepare(`UPDATE songs SET lyrics = ? WHERE id = ?`).run(params.lyrics, version.song_id);
    }
  }
  res.json({ ok: true });
});

/**
 * Delete a version, including the active one — deleting the active version
 * auto-reverts to the layer's next most recently created remaining version
 * (decided 2026-07-02, see PLAN.md). A layer must always keep >=1 version.
 */
versionsRouter.delete('/versions/:versionId', async (req, res) => {
  const version = db
    .prepare(`SELECT id, layer_id, audio_file, active FROM versions WHERE id = ?`)
    .get(req.params.versionId) as { id: string; layer_id: string; audio_file: string; active: number } | undefined;
  if (!version) return res.status(404).json({ error: 'unknown version' });

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM versions WHERE layer_id = ?`)
    .get(version.layer_id) as { count: number };
  if (count <= 1) return res.status(400).json({ error: 'cannot delete the only version of a layer' });

  db.prepare(`DELETE FROM versions WHERE id = ?`).run(version.id);
  if (version.active) {
    const next = db
      .prepare(`SELECT id FROM versions WHERE layer_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(version.layer_id) as { id: string } | undefined;
    if (next) db.prepare(`UPDATE versions SET active = 1 WHERE id = ?`).run(next.id);
  }
  await fs.unlink(path.join(config.audioDir, version.audio_file)).catch(() => {});
  res.json({ ok: true });
});

/** Regenerate a past version as an alternate take — appended to history, not activated. */
versionsRouter.post('/versions/:versionId/regenerate', async (req, res) => {
  try {
    const job = await startRegenerate(req.params.versionId);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'regenerate failed';
    res.status(msg === 'unknown version' ? 404 : 502).json({ error: msg });
  }
});

/** Generate a variance-anchored similar take of a past version — appended to history, not activated. */
versionsRouter.post('/versions/:versionId/retake', async (req, res) => {
  try {
    const job = await startSimilarTake(req.params.versionId);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'retake failed';
    res.status(msg === 'unknown version' ? 404 : 502).json({ error: msg });
  }
});
