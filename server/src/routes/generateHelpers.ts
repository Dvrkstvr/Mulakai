/** Thin ACE-Step passthroughs for the Create screen: format, samples, health, model list.
 * Mounted on generateRouter (generate.ts). */
import { Router } from 'express';
import { health, listModels, formatInput, createRandomSample, createSampleFromQuery } from '../services/acestep.js';

export const generateHelpersRouter = Router();

generateHelpersRouter.post('/format', async (req, res) => {
  try {
    res.json(await formatInput(req.body ?? {}));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

generateHelpersRouter.post('/random-sample', async (req, res) => {
  const sampleType = req.body?.sample_type === 'custom_mode' ? 'custom_mode' : 'simple_mode';
  try {
    res.json(await createRandomSample(sampleType));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
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

generateHelpersRouter.get('/health', async (_req, res) => {
  res.json({ acestep: await health() });
});

generateHelpersRouter.get('/models', async (_req, res) => {
  try {
    res.json(await listModels());
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});
