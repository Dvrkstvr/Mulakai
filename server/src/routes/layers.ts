import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { startRepaint } from '../services/repaintJobs.js';
import { startSplit, type SplitModel } from '../services/stemSplit.js';

export const layersRouter = Router();

/** Update mix state of a layer (volume/mute/solo). */
layersRouter.patch('/:id', (req, res) => {
  const { volume, muted, solo, name } = req.body ?? {};
  const layer = db.prepare(`SELECT id FROM layers WHERE id = ?`).get(req.params.id);
  if (!layer) return res.status(404).json({ error: 'unknown layer' });
  db.prepare(
    `UPDATE layers SET
       volume = COALESCE(?, volume),
       muted  = COALESCE(?, muted),
       solo   = COALESCE(?, solo),
       name   = COALESCE(?, name)
     WHERE id = ?`,
  ).run(
    typeof volume === 'number' ? volume : null,
    typeof muted === 'boolean' ? Number(muted) : null,
    typeof solo === 'boolean' ? Number(solo) : null,
    typeof name === 'string' && name.trim() ? name.trim() : null,
    req.params.id,
  );
  res.json({ ok: true });
});

/** Delete a layer and all its versions. The base layer (the song's original generation) can't be deleted. */
layersRouter.delete('/:id', async (req, res) => {
  const layer = db.prepare(`SELECT kind FROM layers WHERE id = ?`).get(req.params.id) as { kind: string } | undefined;
  if (!layer) return res.status(404).json({ error: 'unknown layer' });
  if (layer.kind === 'base') return res.status(400).json({ error: 'cannot delete the base layer' });

  const versions = db.prepare(`SELECT audio_file FROM versions WHERE layer_id = ?`).all(req.params.id) as { audio_file: string }[];
  db.prepare(`DELETE FROM layers WHERE id = ?`).run(req.params.id); // cascades to versions
  await Promise.all(versions.map((v) => fs.unlink(path.join(config.audioDir, v.audio_file)).catch(() => {})));
  res.json({ ok: true });
});

/** Repaint region range per docs/ace-step-1.5/GUIDE.md#3 (3s min, 90s max). */
const REPAINT_MIN_SECONDS = 3;
const REPAINT_MAX_SECONDS = 90;

/** Repaint a region of this layer's active version -> new version. */
layersRouter.post('/:id/repaint', async (req, res) => {
  const { prompt = '', start = 0, end = -1, audio_cover_strength,
    inference_steps, guidance_scale, use_random_seed, seed, model } = req.body ?? {};
  const regionStart = Number(start);
  const regionEnd = Number(end);
  if (regionEnd > 0) {
    const span = regionEnd - regionStart;
    if (span < REPAINT_MIN_SECONDS || span > REPAINT_MAX_SECONDS) {
      return res.status(400).json({ error: `repaint region must be ${REPAINT_MIN_SECONDS}-${REPAINT_MAX_SECONDS}s (got ${span.toFixed(1)}s)` });
    }
  }
  try {
    const job = await startRepaint(req.params.id, {
      prompt,
      repainting_start: regionStart,
      repainting_end: regionEnd,
      ...(model ? { model } : {}),
      ...(audio_cover_strength !== undefined ? { audio_cover_strength: Number(audio_cover_strength) } : {}),
      ...(inference_steps !== undefined ? { inference_steps: Number(inference_steps) } : {}),
      ...(guidance_scale !== undefined ? { guidance_scale: Number(guidance_scale) } : {}),
      ...(use_random_seed === false ? { use_random_seed: false } : {}),
      ...(seed !== undefined && use_random_seed === false ? { seed: Number(seed) } : {}),
    });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'repaint failed';
    res.status(msg === 'unknown layer' ? 404 : 502).json({ error: msg });
  }
});

/** Start a stem split (vocals/drums/bass/other) of this layer's active version. */
layersRouter.post('/:id/split', async (req, res) => {
  const model = req.body?.model as SplitModel;
  if (model !== 'acestep' && model !== 'demucs') return res.status(400).json({ error: 'model must be acestep or demucs' });
  try {
    const job = await startSplit(req.params.id, model);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'split failed';
    res.status(msg === 'unknown layer' ? 404 : 502).json({ error: msg });
  }
});
