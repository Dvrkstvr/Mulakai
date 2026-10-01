/**
 * READ LYRICS (PLAN.md "Mulakai server for READ LYRICS"): read the words sung in an
 * uploaded source. The job polls through GET /api/generate/:jobId like every other job.
 */
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { lyricsHealth } from '../services/lyricsClient.js';
import { startLyricsTranscription } from '../services/lyricsJobs.js';
import { GenLockError } from '../services/genLock.js';

export const lyricsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: config.lyricsMaxUploadMb * 1024 * 1024 },
}).single('src_audio');
const LANGUAGE = /^[a-z]{2,3}$/;

/** multer's own errors (an oversized file, a broken form) would otherwise reach Express's
 * default handler and come back as an HTML 500 with a stack trace. */
const receiveSource: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `the source is over ${config.lyricsMaxUploadMb} MB` });
    }
    res.status(400).json({ error: `could not read the upload: ${err instanceof Error ? err.message : String(err)}` });
  });
};

/** The lyricsReady probe: configured = LYRICS_API_URL set, ready = it answers. */
lyricsRouter.get('/health', async (_req, res) => {
  res.json({ configured: !!config.lyricsUrl, ready: await lyricsHealth() });
});

lyricsRouter.post('/transcribe', receiveSource, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'src_audio is required' });
  const language = typeof req.body?.language === 'string' ? req.body.language.trim() : '';
  if (language && !LANGUAGE.test(language)) return res.status(400).json({ error: `unknown language "${language}"` });
  if (!config.lyricsUrl) return res.status(400).json({ error: 'READ LYRICS is not set up: LYRICS_API_URL is unset' });
  if (!(await lyricsHealth())) return res.status(400).json({ error: 'READ LYRICS is not set up: lyrics-server is not answering' });

  const filename = req.file.originalname || 'source.wav';
  const label = typeof req.body?.source_label === 'string' && req.body.source_label.trim()
    ? req.body.source_label.trim() : filename;
  try {
    const job = startLyricsTranscription({ data: req.file.buffer, filename, label, language });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
