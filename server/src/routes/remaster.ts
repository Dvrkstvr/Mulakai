import fsp from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getJob } from '../services/jobs.js';
import { startRemaster } from '../services/remasterJobs.js';
import { GenLockError } from '../services/genLock.js';

export const remasterRouter = Router();

// Memory storage: the bounced mix is transient (forwarded to ACE-Step, never
// written to our own disk) — same setup as songLayers.ts's Add Layer upload.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/** Start a remaster job: one-shot `cover` pass over the client-bounced current mix. */
remasterRouter.post('/:id/remaster', upload.single('mix_audio'), async (req, res) => {
  const model = String(req.body?.model ?? '').trim();
  if (!model) return res.status(400).json({ error: 'model is required' });
  if (!req.file) return res.status(400).json({ error: 'mix_audio is required' });
  // multipart: the output block arrives JSON-encoded (see api.ts remaster()).
  let output: unknown;
  try {
    output = req.body?.output ? JSON.parse(String(req.body.output)) : undefined;
  } catch {
    output = undefined;
  }
  const steps = req.body?.steps ? Number(req.body.steps) : undefined;
  try {
    const job = await startRemaster(String(req.params.id), req.file.buffer, model, { output, steps });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    const msg = err instanceof Error ? err.message : 'remaster failed';
    res.status(msg === 'unknown song' ? 404 : 502).json({ error: msg });
  }
});

/** Stream the finished remaster exactly once, then delete the scratch file — it is never kept on the server. */
remasterRouter.get('/:id/remaster/:jobId/download', async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.status !== 'done' || !job.resultPath) return res.status(404).json({ error: 'remaster not ready' });
  const filePath = job.resultPath;
  job.resultPath = undefined;
  res.download(filePath, `remaster${path.extname(filePath)}`, async () => {
    await fsp.unlink(filePath).catch(() => undefined);
  });
});
