import { Router } from 'express';
import { db } from '../db/index.js';
import { startRepaint } from '../services/jobs.js';

export const layersRouter = Router();

/** Update mix state of a layer (volume/mute/solo). */
layersRouter.patch('/:id', (req, res) => {
  const { volume, muted, solo } = req.body ?? {};
  const layer = db.prepare(`SELECT id FROM layers WHERE id = ?`).get(req.params.id);
  if (!layer) return res.status(404).json({ error: 'unknown layer' });
  db.prepare(
    `UPDATE layers SET
       volume = COALESCE(?, volume),
       muted  = COALESCE(?, muted),
       solo   = COALESCE(?, solo)
     WHERE id = ?`,
  ).run(
    typeof volume === 'number' ? volume : null,
    typeof muted === 'boolean' ? Number(muted) : null,
    typeof solo === 'boolean' ? Number(solo) : null,
    req.params.id,
  );
  res.json({ ok: true });
});

/** Repaint a region of this layer's active version -> new version. */
layersRouter.post('/:id/repaint', async (req, res) => {
  const { prompt = '', start = 0, end = -1, repaint_strength, repaint_mode, seed } = req.body ?? {};
  try {
    const job = await startRepaint(req.params.id, {
      prompt,
      repainting_start: Number(start),
      repainting_end: Number(end),
      ...(repaint_strength !== undefined ? { repaint_strength: Number(repaint_strength) } : {}),
      ...(repaint_mode ? { repaint_mode } : {}),
      ...(seed !== undefined ? { seed: Number(seed), use_random_seed: false } : {}),
    });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'repaint failed';
    res.status(msg === 'unknown layer' ? 404 : 502).json({ error: msg });
  }
});

/** Make an older version the active one (revert). */
layersRouter.patch('/versions/:versionId/activate', (req, res) => {
  const version = db
    .prepare(`SELECT id, layer_id FROM versions WHERE id = ?`)
    .get(req.params.versionId) as { id: string; layer_id: string } | undefined;
  if (!version) return res.status(404).json({ error: 'unknown version' });
  db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(version.layer_id);
  db.prepare(`UPDATE versions SET active = 1 WHERE id = ?`).run(version.id);
  res.json({ ok: true });
});
