import { Router } from 'express';
import { config } from '../config.js';
import { listModels } from '../services/acestep.js';
import { getSplitJob, claimStem, reextractStem, cancelSplit, type StemKind } from '../services/stemSplit.js';
import { GenLockError } from '../services/genLock.js';

export const splitRouter = Router();

const STEM_KINDS: StemKind[] = ['vocals', 'drums', 'bass', 'other'];

function isStemKind(v: unknown): v is StemKind {
  return typeof v === 'string' && (STEM_KINDS as string[]).includes(v);
}

splitRouter.get('/health', async (_req, res) => {
  const { models } = await listModels();
  const acestep = models.some((m) => m.supportedTaskTypes.includes('extract'));
  let demucs = false;
  if (config.demucsUrl) {
    try {
      const r = await fetch(`${config.demucsUrl}/health`);
      demucs = r.ok;
    } catch {
      demucs = false;
    }
  }
  res.json({ acestep, demucs });
});

splitRouter.get('/:jobId', (req, res) => {
  const job = getSplitJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown split job' });
  const status = job.stems.every((s) => s.status !== 'running') ? 'done' : 'running';
  res.json({ status, stems: job.stems });
});

splitRouter.post('/:jobId/stems/:kind/replace', (req, res) => {
  if (!isStemKind(req.params.kind)) return res.status(400).json({ error: 'unknown stem kind' });
  try {
    res.json(claimStem(req.params.jobId, req.params.kind, 'replace'));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'replace failed' });
  }
});

splitRouter.post('/:jobId/stems/:kind/add-layer', (req, res) => {
  if (!isStemKind(req.params.kind)) return res.status(400).json({ error: 'unknown stem kind' });
  try {
    res.json(claimStem(req.params.jobId, req.params.kind, 'add-layer'));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'add layer failed' });
  }
});

splitRouter.post('/:jobId/stems/:kind/reextract', (req, res) => {
  if (!isStemKind(req.params.kind)) return res.status(400).json({ error: 'unknown stem kind' });
  try {
    res.json(reextractStem(req.params.jobId, req.params.kind));
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err instanceof Error ? err.message : 're-extract failed' });
  }
});

splitRouter.post('/:jobId/cancel', (req, res) => {
  cancelSplit(req.params.jobId);
  res.json({ ok: true });
});
