import { Router } from 'express';
import { startGeneration } from '../services/jobs.js';
import { QueueFullError } from '../services/genQueue.js';
import { upload, pickParams, pickMultipartParams } from './generateParams.js';
import { generateAudioRouter } from './generateAudio.js';
import { generateHelpersRouter } from './generateHelpers.js';
import { generateStatusRouter } from './generateStatus.js';

export const generateRouter = Router();

/** Accepts both plain JSON (the common case, unchanged) and multipart form-data (only when
 * the client is attaching an ad-hoc reference-audio upload — see ReferenceAudioPicker.tsx).
 * multer only engages for multipart requests; a JSON request's `req.files` stays undefined
 * since express.json() already parsed `req.body` before this middleware runs. */
generateRouter.post('/', upload.fields([{ name: 'reference_audio', maxCount: 1 }]), async (req, res) => {
  const body = req.body ?? {};
  const { title = 'Untitled', voiceId, audio_influence, style_influence, folder_id } = body;
  const isMultipart = req.files !== undefined;
  const refFile = (req.files as Record<string, Express.Multer.File[] | undefined> | undefined)?.reference_audio?.[0];
  try {
    const job = await startGeneration(isMultipart ? pickMultipartParams(body) : pickParams(body), title, {
      voiceId: voiceId ? String(voiceId) : undefined,
      audioInfluence: audio_influence !== undefined ? Number(audio_influence) : undefined,
      styleInfluence: style_influence !== undefined ? Number(style_influence) : undefined,
      referenceAudioFile: refFile ? { data: refFile.buffer, filename: refFile.originalname || 'reference.wav' } : undefined,
    }, folder_id ? String(folder_id) : undefined);
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

// Registration order matches the routes' original order in this file: cover/complete/analyze
// (generateAudio.ts), ACE-Step passthroughs (generateHelpers.ts), then job status
// (generateStatus.ts) last, since its `GET /:jobId` would shadow any GET mounted after it.
generateRouter.use(generateAudioRouter);
generateRouter.use(generateHelpersRouter);
generateRouter.use(generateStatusRouter);
