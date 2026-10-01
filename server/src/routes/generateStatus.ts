/** Job status: the active generation, its dev abort, and polling a job by id.
 * Mounted last on generateRouter (generate.ts) so `/:jobId` shadows nothing. */
import { Router } from 'express';
import { getJob, getActiveGeneration, abortJob } from '../services/jobs.js';
import { discardScratchSplit } from '../services/scratchSplitJobs.js';
import { cancelSplit } from '../services/stemSplit.js';
import { releaseGenLock } from '../services/genLock.js';

export const generateStatusRouter = Router();

/** The currently locked generation (any kind), for the client to rehydrate its
 * "generating" library card across a page refresh. Placed before `/:jobId` so
 * it isn't shadowed by that param route. */
generateStatusRouter.get('/active', (_req, res) => {
  const { lock, job } = getActiveGeneration();
  if (!lock) return res.json({ active: null });
  res.json({
    active: {
      kind: lock.kind,
      jobId: lock.jobId,
      songId: lock.songId,
      title: lock.title,
      caption: lock.caption,
      task: lock.task,
      engine: lock.engine,
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
generateStatusRouter.post('/active/abort', (_req, res) => {
  const { lock } = getActiveGeneration();
  if (!lock) return res.json({ ok: true, aborted: false });
  if (lock.kind === 'split') {
    void cancelSplit(lock.jobId).catch(() => {});
    void discardScratchSplit(lock.jobId).catch(() => {});
  } else {
    abortJob(lock.jobId);
  }
  releaseGenLock(lock.jobId);
  res.json({ ok: true, aborted: true });
});

generateStatusRouter.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({
    status: job.status, songId: job.songId, error: job.error,
    progress: job.progress, progressStage: job.progressStage, progressText: job.progressText,
    // Only a finished TRANSCRIBE carries this: the score and SheetSage2's facts.
    ...(job.transcription ? { transcription: job.transcription } : {}),
    // Only a finished READ LYRICS carries this: the sung words, timed.
    ...(job.lyrics ? { lyrics: job.lyrics } : {}),
  });
});
