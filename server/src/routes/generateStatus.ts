/** Job status: the running job, the queue behind it, abort/cancel, and polling a job by id.
 * Mounted last on generateRouter (generate.ts) so `/:jobId` shadows nothing. */
import { Router } from 'express';
import { getJob, getActiveGeneration, abortJob } from '../services/jobs.js';
import { discardScratchSplit } from '../services/scratchSplitJobs.js';
import { cancelSplit } from '../services/stemSplit.js';
import { cancelQueued, getQueued, getRunning, queuePosition, releaseSlot, type QueueInfo } from '../services/genQueue.js';
import { songTitle } from '../services/queueGuards.js';

export const generateStatusRouter = Router();

/** The running job (any kind), for the client to rehydrate its "generating" library card
 * across a page refresh. Placed before `/:jobId` so it isn't shadowed by that param route. */
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

/** What a queue row tells the client: the job, and a title even for an edit queued elsewhere. */
function describe(info: QueueInfo) {
  const { kind, jobId, songId, layer, label, task, engine } = info;
  return { kind, jobId, songId, title: info.title ?? (songId ? songTitle(songId) : undefined), layer, label, task, engine };
}

/** Activity's RUNNING holder and UP NEXT rows (PLAN.md "UI Redesign", S4 decision 4). */
generateStatusRouter.get('/queue', (_req, res) => {
  const running = getRunning();
  res.json({
    running: running ? { ...describe(running), startedAt: running.startedAt } : null,
    queued: getQueued().map((q) => ({ ...describe(q), position: q.position, queuedAt: q.queuedAt })),
  });
});

/**
 * Best-effort stop of the running job (any kind, including a Demucs/ACE-Step split), freeing
 * the slot for the next queued job. See jobs.ts's abortJob and stemSplit.ts's cancelSplit for
 * why in-flight backend calls can't actually be killed, only ignored.
 */
function abortRunning(): boolean {
  const lock = getRunning();
  if (!lock) return false;
  if (lock.kind === 'split') {
    void cancelSplit(lock.jobId).catch(() => {});
    void discardScratchSplit(lock.jobId).catch(() => {});
  } else {
    abortJob(lock.jobId);
  }
  releaseSlot(lock.jobId);
  return true;
}

generateStatusRouter.post('/active/abort', (_req, res) => {
  res.json({ ok: true, aborted: abortRunning() });
});

/** CANCEL on an UP NEXT row: a queued job leaves the line and settles `cancelled`. The running
 * job's cancel is the same best-effort ABORT as above. */
generateStatusRouter.post('/:jobId/cancel', (req, res) => {
  const { jobId } = req.params;
  if (cancelQueued(jobId)) return res.json({ ok: true, cancelled: true });
  if (getRunning()?.jobId === jobId) return res.json({ ok: true, aborted: abortRunning() });
  res.status(404).json({ error: 'this job is neither queued nor running' });
});

generateStatusRouter.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'unknown job' });
  res.json({
    status: job.status, songId: job.songId, error: job.error,
    progress: job.progress, progressStage: job.progressStage, progressText: job.progressText,
    ...(job.status === 'queued' ? { queuePosition: queuePosition(job.id) } : {}),
    ...(job.cancelled ? { cancelled: true } : {}),
    // Only a finished TRANSCRIBE carries this: the score and SheetSage2's facts.
    ...(job.transcription ? { transcription: job.transcription } : {}),
    // Only a finished READ LYRICS carries this: the sung words, timed.
    ...(job.lyrics ? { lyrics: job.lyrics } : {}),
    // Only a finished ANALYZE AUDIO carries this: ACE-Step's description of the source.
    ...(job.analysis ? { analysis: job.analysis } : {}),
  });
});
