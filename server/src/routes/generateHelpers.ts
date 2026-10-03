/** Thin ACE-Step passthroughs for the Create screen: format, samples, health, model list.
 * Mounted on generateRouter (generate.ts). */
import { Router } from 'express';
import { config } from '../config.js';
import { getRunning, QueueFullError } from '../services/genQueue.js';
import { healthState, listModels, formatInput, createSampleFromQuery } from '../services/acestep.js';
import { startSample } from '../services/sampleJobs.js';

export const generateHelpersRouter = Router();

generateHelpersRouter.post('/format', async (req, res) => {
  try {
    res.json(await formatInput(req.body ?? {}));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

/** FEELING LUCKY: queued like every LM/DiT job (sampleJobs.ts); poll GET /:jobId for `sample`. */
generateHelpersRouter.post('/random-sample', (req, res) => {
  const sampleType = req.body?.sample_type === 'custom_mode' ? 'custom_mode' : 'simple_mode';
  try {
    res.status(202).json({ jobId: startSample(sampleType).id });
  } catch (err) {
    if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

generateHelpersRouter.post('/sample-from-query', async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  try {
    res.json(await createSampleFromQuery({ query, vocalLanguage: req.body?.vocal_language }));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

/** `busy`: ACE-Step went silent while a job holds the queue's slot — it answers nothing
 * mid-generation, so that silence is work in progress, not an outage. */
generateHelpersRouter.get('/health', async (_req, res) => {
  const state = await healthState();
  res.json({ acestep: state === 'up', busy: state === 'silent' && getRunning() !== null });
});

generateHelpersRouter.get('/models', async (_req, res) => {
  try {
    res.json(await listModels(config.acestepLookupTimeoutMs));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});
