import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { listModels } from '../services/acestep.js';
import { getSplitJob, claimStem, reextractStem, cancelSplit, type StemKind, type SplitModel } from '../services/stemSplit.js';
import { startScratchSplit, getScratchSplitJob, discardScratchSplit, scratchStemPath } from '../services/scratchSplitJobs.js';
import { GenLockError } from '../services/genLock.js';

export const splitRouter = Router();

// Memory storage: the uploaded file is forwarded to ACE-Step/Demucs, never written to our
// own disk directly — same setup as generate.ts's /from-audio upload.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const STEM_KINDS: StemKind[] = ['vocals', 'drums', 'bass', 'other'];

/** The output block arrives as a JSON string on this multipart route (every other
 * route gets it already parsed by express.json()). Malformed input falls through
 * to parseOutputSettings' defaults rather than failing the split. */
function parseOutputBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

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

/** Standalone stem split: upload any audio file, get stems back with no song/library entry
 * created — usable on its own (download the stems) or as a source-picker step for Complete
 * generation. Placed before the generic `/:jobId` route below so `/scratch` isn't shadowed. */
splitRouter.post('/scratch', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio is required' });
  const model: SplitModel = req.body?.model === 'demucs' ? 'demucs' : 'acestep';
  try {
    const job = await startScratchSplit(
      { data: req.file.buffer, filename: req.file.originalname || 'source.wav' }, model, parseOutputBody(req.body?.output),
    );
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

splitRouter.get('/scratch/:jobId', (req, res) => {
  const job = getScratchSplitJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown split job' });
  const status = job.stems.every((s) => s.status !== 'running') ? 'done' : 'running';
  res.json({ status, stems: job.stems.map((s) => ({ kind: s.kind, status: s.status, error: s.error })) });
});

splitRouter.get('/scratch/:jobId/:kind/download', (req, res) => {
  const job = getScratchSplitJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown split job' });
  if (!isStemKind(req.params.kind)) return res.status(400).json({ error: 'unknown stem kind' });
  const filePath = scratchStemPath(job, req.params.kind);
  if (!filePath) return res.status(404).json({ error: 'stem not ready' });
  // Extension follows the job's own output settings, not a fixed container.
  res.download(filePath, `${req.params.kind}${path.extname(filePath)}`);
});

splitRouter.post('/scratch/:jobId/discard', async (req, res) => {
  await discardScratchSplit(req.params.jobId);
  res.json({ ok: true });
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
