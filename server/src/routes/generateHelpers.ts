/** The Create screen's ACE-Step helpers: the LM's format and samples (queued jobs), health,
 * model list. Mounted on generateRouter (generate.ts). */
import { Router, type Response } from 'express';
import { config } from '../config.js';
import { getRunning, QueueFullError } from '../services/genQueue.js';
import { healthState, listModels, formatInput, createRandomSample, createSampleFromQuery, type SampleResult } from '../services/acestep.js';
import { startLmJob, type LmLabel } from '../services/lmJobs.js';

export const generateHelpersRouter = Router();

/** Queues one LM call (lmJobs.ts) and answers 202 { jobId }: poll GET /:jobId for `sample`.
 * A full queue answers 409 with the reason. */
function queueLm(res: Response, label: LmLabel, write: () => Promise<SampleResult>) {
  try {
    res.status(202).json({ jobId: startLmJob(label, write).id });
  } catch (err) {
    if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/** WRITE FOR ME. */
generateHelpersRouter.post('/format', (req, res) => {
  const params = req.body ?? {};
  queueLm(res, 'write for me', () => formatInput(params));
});

/** FEELING LUCKY. */
generateHelpersRouter.post('/random-sample', (req, res) => {
  const sampleType = req.body?.sample_type === 'custom_mode' ? 'custom_mode' : 'simple_mode';
  queueLm(res, 'feeling lucky', () => createRandomSample(sampleType));
});

/** Quick Start: the library create bar's typed idea, expanded into a draft. */
generateHelpersRouter.post('/sample-from-query', (req, res) => {
  const query = req.body?.query;
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  const vocalLanguage = req.body?.vocal_language;
  queueLm(res, 'quick start', () => createSampleFromQuery({ query, vocalLanguage }));
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
