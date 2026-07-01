import { Router } from 'express';
import { startGeneration, getJob } from '../services/jobs.js';
import { health } from '../services/acestep.js';

export const generateRouter = Router();

generateRouter.post('/', async (req, res) => {
  const { title = 'Untitled', ...params } = req.body ?? {};
  try {
    const job = await startGeneration(params, title);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

generateRouter.get('/health', async (_req, res) => {
  res.json({ acestep: await health() });
});

generateRouter.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({ status: job.status, songId: job.songId, error: job.error });
});
