import { Router } from 'express';
import { startGeneration, getJob } from '../services/jobs.js';
import {
  health,
  listModels,
  formatInput,
  createRandomSample,
  createSampleFromQuery,
  type ReleaseTaskParams,
} from '../services/acestep.js';

export const generateRouter = Router();

const GEN_FIELDS: (keyof ReleaseTaskParams)[] = [
  'prompt', 'lyrics', 'model', 'lm_model_path', 'thinking', 'use_format', 'use_cot_caption',
  'use_cot_language', 'bpm', 'key_scale',
  'time_signature', 'vocal_language', 'audio_duration', 'inference_steps',
  'guidance_scale', 'use_random_seed', 'seed',
];

function pickParams(body: Record<string, unknown>): ReleaseTaskParams {
  const out: Record<string, unknown> = {};
  for (const key of GEN_FIELDS) if (body[key] !== undefined) out[key] = body[key];
  return out as ReleaseTaskParams;
}

generateRouter.post('/', async (req, res) => {
  const { title = 'Untitled' } = req.body ?? {};
  try {
    const job = await startGeneration(pickParams(req.body ?? {}), title);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

generateRouter.post('/format', async (req, res) => {
  try {
    res.json(await formatInput(req.body ?? {}));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

generateRouter.post('/random-sample', async (req, res) => {
  const sampleType = req.body?.sample_type === 'custom_mode' ? 'custom_mode' : 'simple_mode';
  try {
    res.json(await createRandomSample(sampleType));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

generateRouter.post('/sample-from-query', async (req, res) => {
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

generateRouter.get('/health', async (_req, res) => {
  res.json({ acestep: await health() });
});

generateRouter.get('/models', async (_req, res) => {
  res.json(await listModels());
});

generateRouter.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({ status: job.status, songId: job.songId, error: job.error });
});
