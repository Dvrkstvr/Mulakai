/**
 * Song-creation engines (PLAN.md "Multiple Song-Creation Engines", design point 13).
 * Polling an engine job reuses `GET /api/generate/:jobId` — engine jobs live in the
 * same job map as ACE-Step's.
 */
import { Router } from 'express';
import { listEngines, getEngine } from '../services/engines/registry.js';
import { startEngineGeneration } from '../services/engineGenJobs.js';
import { GenLockError } from '../services/genLock.js';
import type { CreateFields } from '../services/engines/types.js';

export const enginesRouter = Router();

const STRING_FIELDS = ['prompt', 'lyrics', 'key_scale', 'time_signature', 'vocal_language'] as const;
const NUMBER_FIELDS = ['bpm', 'audio_duration', 'guidance_scale', 'seed', 'cfg', 'temperature', 'top_k'] as const;
const COT_VALUES = new Set(['full', 'melody', 'off']);

/** The Create fields an engine may map, under the same names `POST /api/generate` takes.
 * Anything mistyped is dropped, which is AUTO. JSON only: no extra engine takes audio. */
export function pickCreateFields(body: Record<string, unknown>): CreateFields {
  const out: CreateFields = {};
  for (const key of STRING_FIELDS) if (typeof body[key] === 'string') out[key] = body[key];
  for (const key of NUMBER_FIELDS) {
    const v = body[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  if (typeof body.use_random_seed === 'boolean') out.use_random_seed = body.use_random_seed;
  if (typeof body.cot === 'string' && COT_VALUES.has(body.cot)) out.cot = body.cot as CreateFields['cot'];
  if (body.output !== undefined) out.output = body.output;
  return out;
}

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
