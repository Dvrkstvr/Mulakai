/** Generations and analysis that read a source track: cover, complete, and analyze-audio.
 * Mounted on generateRouter (generate.ts). */
import fs from 'node:fs/promises';
import { Router } from 'express';
import { startCoverGeneration } from '../services/coverGenJobs.js';
import { startCompleteGeneration, type CompleteSource } from '../services/completeGenJobs.js';
import { getScratchSplitJob, scratchStemPath, SCRATCH_GONE } from '../services/scratchSplitJobs.js';
import { resolveReferenceAudioFile } from '../services/referenceAudioResolve.js';
import { GenLockError } from '../services/genLock.js';
import { analyzeUnderLock } from '../services/analyzeJobs.js';
import { upload, pickMultipartParams, withCoverStrength, labelOnlyReferenceMeta } from './generateParams.js';

export const generateAudioRouter = Router();

/** "Create cover from audio": a `cover` generation conditioned on an uploaded/bounced source
 * track, persisted as a new song (see coverGenJobs.ts). Reference audio is optional and never
 * remaps audio_influence/style_influence — see referenceAudioResolve.ts's rationale. */
generateAudioRouter.post(
  '/from-audio',
  upload.fields([{ name: 'src_audio', maxCount: 1 }, { name: 'reference_audio', maxCount: 1 }]),
  async (req, res) => {
    const { title = 'Untitled', voice_id, folder_id } = req.body ?? {};
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const srcFile = files.src_audio?.[0];
    if (!srcFile) return res.status(400).json({ error: 'src_audio is required' });
    try {
      const refFile = files.reference_audio?.[0];
      const referenceAudio = await resolveReferenceAudioFile(
        refFile ? { data: refFile.buffer, filename: refFile.originalname || 'reference.wav' } : undefined,
        voice_id ? String(voice_id) : undefined,
      );
      const job = startCoverGeneration(
        srcFile.buffer, String(title),
        withCoverStrength(pickMultipartParams(req.body ?? {}), req.body?.audio_cover_strength), referenceAudio,
        folder_id ? String(folder_id) : undefined,
        labelOnlyReferenceMeta(refFile, voice_id ? String(voice_id) : undefined),
      );
      res.status(202).json({ jobId: job.id });
    } catch (err) {
      if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
      res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
    }
  },
);

/** "Complete": a `complete` generation conditioned on a single bare source track (uploaded
 * directly, or referenced from a prior scratch stem-split job so the client doesn't have to
 * re-download+re-upload a stem it already produced server-side), with an optional separate
 * reference-audio file for style/timbre. Persisted as a new song (see completeGenJobs.ts). */
generateAudioRouter.post(
  '/complete',
  upload.fields([{ name: 'src_audio', maxCount: 1 }, { name: 'reference_audio', maxCount: 1 }]),
  async (req, res) => {
    const { title = 'Untitled', scratch_job_id, scratch_stem_kind, voice_id, folder_id } = req.body ?? {};
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const uploadedSrc = files.src_audio?.[0];
    const refFile = files.reference_audio?.[0];

    let src: CompleteSource | undefined;
    try {
      if (uploadedSrc) {
        src = { data: uploadedSrc.buffer, filename: uploadedSrc.originalname || 'source.wav' };
      } else if (scratch_job_id && scratch_stem_kind) {
        const job = getScratchSplitJob(String(scratch_job_id));
        const filePath = job && scratchStemPath(job, String(scratch_stem_kind));
        if (!filePath) return res.status(400).json({ error: job ? 'scratch stem not ready' : SCRATCH_GONE });
        src = { data: await fs.readFile(filePath), filename: `${scratch_stem_kind}.mp3` };
      }
      if (!src) return res.status(400).json({ error: 'src_audio or scratch_job_id/scratch_stem_kind is required' });

      const referenceAudio = await resolveReferenceAudioFile(
        refFile ? { data: refFile.buffer, filename: refFile.originalname || 'reference.wav' } : undefined,
        voice_id ? String(voice_id) : undefined,
      );
      const job = startCompleteGeneration(
        src, String(title), pickMultipartParams(req.body ?? {}), referenceAudio,
        folder_id ? String(folder_id) : undefined,
        labelOnlyReferenceMeta(refFile, voice_id ? String(voice_id) : undefined),
      );
      res.status(202).json({ jobId: job.id });
    } catch (err) {
      if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
      res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
    }
  },
);

/** "Describe this audio for me" — analyzes an uploaded source track (or a scratch stem,
 * same dual-source resolution `/complete` uses above) via ACE-Step's `/v1/analyze_audio`
 * and returns its caption/lyrics/metadata guess for the client to prefill Create fields.
 * Holds the genLock (`analyze`) for the call, so it 409s next to any other job. */
generateAudioRouter.post('/analyze-audio', upload.fields([{ name: 'src_audio', maxCount: 1 }]), async (req, res) => {
  const { scratch_job_id, scratch_stem_kind, model } = req.body ?? {};
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
  const uploadedSrc = files.src_audio?.[0];

  try {
    let file: { data: Buffer; filename: string } | undefined;
    if (uploadedSrc) {
      file = { data: uploadedSrc.buffer, filename: uploadedSrc.originalname || 'source.wav' };
    } else if (scratch_job_id && scratch_stem_kind) {
      const job = getScratchSplitJob(String(scratch_job_id));
      const filePath = job && scratchStemPath(job, String(scratch_stem_kind));
      if (!filePath) return res.status(400).json({ error: job ? 'scratch stem not ready' : SCRATCH_GONE });
      file = { data: await fs.readFile(filePath), filename: `${scratch_stem_kind}.mp3` };
    }
    if (!file) return res.status(400).json({ error: 'src_audio or scratch_job_id/scratch_stem_kind is required' });

    res.json(await analyzeUnderLock(file, model ? String(model) : undefined));
  } catch (err) {
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});
