/**
 * COVER on an extra engine (PLAN.md "YuE2 Melody Covers via SheetSage2" and "Mulakai server
 * cover decisions"): TRANSCRIBE a source into a score, stream that score's piano preview,
 * then GENERATE a cover from the score as a new song. Mounted under /api/engines; jobs poll
 * through GET /api/generate/:jobId like every other job.
 */
import { Router, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getEngine, coverReady } from '../services/engines/registry.js';
import { startTranscription } from '../services/transcribeJobs.js';
import { fetchTranscriptionPreview } from '../services/engineTranscribeClient.js';
import { startEngineGeneration } from '../services/engineGenJobs.js';
import { getJob } from '../services/jobs.js';
import { GenLockError } from '../services/genLock.js';
import type { SongEngine } from '../services/engines/types.js';
import { pickCreateFields } from './createFields.js';

export const coversRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: config.coverMaxUploadMb * 1024 * 1024 },
}).single('src_audio');
/** yue-server's own limit on a supplied score. */
const MAX_SCORE_BYTES = 65536;
const PREVIEW_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
/** How long the engine may take to start answering a preview request; the body itself is untimed. */
const PREVIEW_HEADERS_TIMEOUT_MS = 10_000;

/** The engine for a cover route, or undefined after answering the request itself. */
function coverEngine(id: string, res: Response): SongEngine | undefined {
  const engine = getEngine(id);
  if (!engine) {
    res.status(404).json({ error: `unknown engine "${id}"` });
    return undefined;
  }
  if (!engine.toCoverRequest) {
    res.status(400).json({ error: `${engine.label} cannot make a cover` });
    return undefined;
  }
  if (!engine.url) {
    res.status(400).json({ error: `${engine.label} is not configured` });
    return undefined;
  }
  return engine;
}

/** multer's own errors (an oversized file, a broken form) would otherwise reach Express's
 * default handler and come back as an HTML 500 with a stack trace. Same as routes/lyrics.ts. */
const receiveSource: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `the source is over ${config.coverMaxUploadMb} MB` });
    }
    res.status(400).json({ error: `could not read the upload: ${err instanceof Error ? err.message : String(err)}` });
  });
};

function lockOrServerError(res: Response, err: unknown) {
  if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
}

coversRouter.post('/:id/transcribe', receiveSource, async (req, res) => {
  const engine = coverEngine(String(req.params.id), res);
  if (!engine) return;
  if (!req.file) return res.status(400).json({ error: 'src_audio is required' });
  if (!(await coverReady(engine))) {
    return res.status(400).json({ error: `covers are not set up on ${engine.label}: its transcriber is not answering` });
  }
  const filename = req.file.originalname || 'source.wav';
  const label = typeof req.body?.source_label === 'string' && req.body.source_label.trim()
    ? req.body.source_label.trim() : filename;
  try {
    const job = startTranscription(engine, { data: req.file.buffer, filename, label });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    lockOrServerError(res, err);
  }
});

/** Streams the engine's piano preview, forwarding Range so the player can seek. The engine
 * keeps it for its retention window; after that this is a 404 (re-transcribe).
 *
 * A player reads a little, then holds the connection idle while paused, or drops it to
 * seek. So only the wait for response headers is timed. The engine is told to stop as soon
 * as the listener leaves, and `pipeline` owns both ends, so a broken stream can never go
 * unhandled. A bare `.pipe()` with a whole-request timeout crashed the server here. */
coversRouter.get('/:id/transcribe/:jobId/preview', async (req, res) => {
  const engine = coverEngine(String(req.params.id), res);
  if (!engine) return;
  const job = getJob(String(req.params.jobId));
  if (!job?.transcription?.hasPreview) return res.status(404).json({ error: 'no preview for this job' });
  const upstreamAbort = new AbortController();
  res.on('close', () => upstreamAbort.abort());
  const headersTimer = setTimeout(() => upstreamAbort.abort(), PREVIEW_HEADERS_TIMEOUT_MS);
  let upstream: globalThis.Response;
  try {
    upstream = await fetchTranscriptionPreview(engine, job.taskId, req.headers.range, upstreamAbort.signal);
  } catch (err) {
    if (!res.headersSent && !res.destroyed) res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  } finally {
    clearTimeout(headersTimer);
  }
  if (!upstream.ok || !upstream.body) return res.status(upstream.status === 416 ? 416 : 404).json({ error: 'preview unavailable' });
  res.status(upstream.status);
  for (const name of PREVIEW_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  // Rejects when either side goes away mid-stream: a listener leaving is normal, so it's ignored.
  await pipeline(Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream), res).catch(() => {});
});

coversRouter.post('/:id/cover', (req, res) => {
  const engine = coverEngine(String(req.params.id), res);
  if (!engine) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const abc = typeof body.abc === 'string' ? body.abc : '';
  if (!abc.trim()) return res.status(400).json({ error: 'abc (the score to cover) is required' });
  if (Buffer.byteLength(abc, 'utf8') > MAX_SCORE_BYTES) return res.status(400).json({ error: 'the score is over 64 KB' });
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'score';
  const title = typeof body.title === 'string' && body.title ? body.title : 'Untitled';
  const folderId = typeof body.folder_id === 'string' && body.folder_id ? body.folder_id : undefined;
  try {
    const job = startEngineGeneration(engine, pickCreateFields(body), title, folderId, { abc, source });
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    lockOrServerError(res, err);
  }
});

/** The score a cover was made from (its first base version's `request.abc`), so REUSE PROMPT
 * can cover the same melody again without transcribing. 404 for anything else. */
coversRouter.get('/:id/covers/:songId/score', (req, res) => {
  const row = db.prepare(
    `SELECT v.params_json FROM versions v JOIN layers l ON v.layer_id = l.id
     WHERE l.song_id = ? AND l.kind = 'base' ORDER BY v.created_at ASC LIMIT 1`,
  ).get(req.params.songId) as { params_json: string } | undefined;
  const params = row ? (JSON.parse(row.params_json) as { engine?: string; task_type?: string; request?: { abc?: unknown } }) : {};
  const abc = params.request?.abc;
  if (params.engine !== req.params.id || params.task_type !== 'cover' || typeof abc !== 'string') {
    return res.status(404).json({ error: 'not a cover with a stored score' });
  }
  res.type('text/plain; charset=utf-8').send(abc);
});
