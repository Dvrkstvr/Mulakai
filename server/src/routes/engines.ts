/**
 * Song-creation engines (PLAN.md "Multiple Song-Creation Engines", design point 13).
 * Polling an engine job reuses `GET /api/generate/:jobId` — engine jobs live in the
 * same job map as ACE-Step's.
 */
import { Router } from 'express';
import { listEngines, getEngine } from '../services/engines/registry.js';
import { startEngineGeneration } from '../services/engineGenJobs.js';
import { GenLockError } from '../services/genLock.js';
import { pickCreateFields } from './createFields.js';
import { coversRouter } from './engineCovers.js';

export const enginesRouter = Router();
export { pickCreateFields };

enginesRouter.get('/', async (_req, res) => {
  res.json(await listEngines());
});

enginesRouter.post('/:id/generate', (req, res) => {
  const { id } = req.params;
  if (id === 'acestep') return res.status(400).json({ error: 'ACE-Step generates through /api/generate' });
  const engine = getEngine(id);
  if (!engine) return res.status(404).json({ error: `unknown engine "${id}"` });
  if (!engine.url) return res.status(400).json({ error: `${engine.label} is not configured` });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' && body.title ? body.title : 'Untitled';
  const folderId = typeof body.folder_id === 'string' && body.folder_id ? body.folder_id : undefined;
  try {
    const job = startEngineGeneration(engine, pickCreateFields(body), title, folderId);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// TRANSCRIBE, its preview, COVER and a cover's stored score (engineCovers.ts).
enginesRouter.use(coversRouter);
