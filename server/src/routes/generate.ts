import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { startGeneration, getJob, getActiveGeneration, abortJob } from '../services/jobs.js';
import { startCoverGeneration } from '../services/coverGenJobs.js';
import { startCompleteGeneration, type CompleteSource } from '../services/completeGenJobs.js';
import { getScratchSplitJob, scratchStemPath, discardScratchSplit } from '../services/scratchSplitJobs.js';
import { cancelSplit } from '../services/stemSplit.js';
import { resolveReferenceAudioFile } from '../services/referenceAudioResolve.js';
import { getVoiceName } from '../services/voiceConditioning.js';
import type { ReferenceAudioMeta } from '../services/jobs.js';
import { GenLockError, releaseGenLock } from '../services/genLock.js';
import {
  health,
  listModels,
  formatInput,
  createRandomSample,
  createSampleFromQuery,
  analyzeAudio,
  type ReleaseTaskParams,
} from '../services/acestep.js';

export const generateRouter = Router();

// Memory storage: the source file is forwarded to ACE-Step, never written to our own disk —
// same setup as remaster.ts / songLayers.ts's mix uploads.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const GEN_FIELDS: (keyof ReleaseTaskParams)[] = [
  'prompt', 'lyrics', 'model', 'lm_model_path', 'thinking', 'use_format', 'use_cot_caption',
  'use_cot_language', 'bpm', 'key_scale',
  'time_signature', 'vocal_language', 'audio_duration', 'inference_steps',
  'guidance_scale', 'use_random_seed', 'seed', 'batch_size', 'audio_format',
  'shift', 'infer_method', 'timesteps', 'use_adg', 'cfg_interval_start', 'cfg_interval_end',
  'lm_temperature', 'lm_cfg_scale', 'lm_negative_prompt', 'lm_top_k', 'lm_top_p', 'lm_repetition_penalty',
];

/** Fields that arrive as strings over multipart form-data and need coercing back to their real type. */
const NUMERIC_FIELDS = new Set([
  'bpm', 'audio_duration', 'inference_steps', 'guidance_scale', 'seed', 'batch_size',
  'shift', 'cfg_interval_start', 'cfg_interval_end',
  'lm_temperature', 'lm_cfg_scale', 'lm_top_k', 'lm_top_p', 'lm_repetition_penalty',
]);

/** Label-only reference-audio meta for cover/complete (influences don't apply there — see
 * referenceAudioResolve.ts). Null when no reference was used. */
function labelOnlyReferenceMeta(refFile?: Express.Multer.File, voiceId?: string): ReferenceAudioMeta | null {
  const label = refFile ? (refFile.originalname || 'reference.wav') : voiceId ? getVoiceName(voiceId) : null;
  return label ? { label, audioInfluence: null, styleInfluence: null } : null;
}

function pickParams(body: Record<string, unknown>): ReleaseTaskParams {
  const out: Record<string, unknown> = {};
  for (const key of GEN_FIELDS) if (body[key] !== undefined) out[key] = body[key];
  return out as ReleaseTaskParams;
}

function pickMultipartParams(body: Record<string, unknown>): ReleaseTaskParams {
  const picked = pickParams(body);
  const out = picked as Record<string, unknown>;
  for (const key of NUMERIC_FIELDS) if (out[key] !== undefined) out[key] = Number(out[key]);
  return out as ReleaseTaskParams;
}

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
    if (err instanceof GenLockError) return res.status(409).json({ error: err.message });
    res.status(502).json({ error: err instanceof Error ? err.message : 'ACE-Step unreachable' });
  }
});

/** "Create cover from audio": a `cover` generation conditioned on an uploaded/bounced source
 * track, persisted as a new song (see coverGenJobs.ts). Reference audio is optional and never
 * remaps audio_influence/style_influence — see referenceAudioResolve.ts's rationale. */
generateRouter.post(
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
        srcFile.buffer, String(title), pickMultipartParams(req.body ?? {}), referenceAudio,
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
generateRouter.post(
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
        if (!filePath) return res.status(400).json({ error: 'unknown or not-ready scratch stem' });
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
 * and returns its caption/lyrics/metadata guess for the client to prefill Create fields. */
generateRouter.post('/analyze-audio', upload.fields([{ name: 'src_audio', maxCount: 1 }]), async (req, res) => {
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
      if (!filePath) return res.status(400).json({ error: 'unknown or not-ready scratch stem' });
      file = { data: await fs.readFile(filePath), filename: `${scratch_stem_kind}.mp3` };
    }
    if (!file) return res.status(400).json({ error: 'src_audio or scratch_job_id/scratch_stem_kind is required' });

    res.json(await analyzeAudio(file, model ? String(model) : undefined));
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

/** The currently locked generation (any kind), for the client to rehydrate its
 * "generating" library card across a page refresh. Placed before `/:jobId` so
 * it isn't shadowed by that param route. */
generateRouter.get('/active', (_req, res) => {
  const { lock, job } = getActiveGeneration();
  if (!lock) return res.json({ active: null });
  res.json({
    active: {
      kind: lock.kind,
      jobId: lock.jobId,
      songId: lock.songId,
      title: lock.title,
      caption: lock.caption,
      startedAt: lock.startedAt,
      status: job?.status ?? 'running',
      error: job?.error,
    },
  });
});

/**
 * Dev convenience: forcibly stop whatever's holding the generation lock (any kind,
 * including a Demucs/ACE-Step split) so local development isn't blocked waiting out a
 * long-running job. Best-effort — see jobs.ts's abortJob and stemSplit.ts's cancelSplit
 * for why in-flight backend calls can't actually be killed, only ignored.
 */
generateRouter.post('/active/abort', (_req, res) => {
  const { lock } = getActiveGeneration();
  if (!lock) return res.json({ ok: true, aborted: false });
  if (lock.kind === 'split') {
    cancelSplit(lock.jobId);
    void discardScratchSplit(lock.jobId).catch(() => {});
  } else {
    abortJob(lock.jobId);
  }
  releaseGenLock(lock.jobId);
  res.json({ ok: true, aborted: true });
});

generateRouter.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({
    status: job.status, songId: job.songId, error: job.error,
    progress: job.progress, progressStage: job.progressStage, progressText: job.progressText,
  });
});
