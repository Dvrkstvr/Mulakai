/**
 * "Create cover from audio": a `cover`-task generation conditioned on an
 * uploaded file or a client-bounced mix of an existing library song,
 * persisted as a brand-new song. Unlike remasterJobs.ts's scratch-only cover
 * pass (which re-renders a song's own current mix and is never saved), this
 * one goes through the same persistSong() path as a plain text2music
 * generation and shares its `generate` genLock kind, so the rest of the app
 * (library GeneratingCard, cross-tab hydration) treats it identically.
 */
import crypto from 'node:crypto';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, run, registerJob, persistSong, poll, ensureModelLoaded, wasAborted } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';

export function startCoverGeneration(
  srcAudio: Buffer,
  title: string,
  params: ReleaseTaskParams,
  referenceAudio?: { data: Buffer; filename: string },
): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: params.prompt });
  registerJob(job);
  void run(job, async () => {
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'cover' };
    await ensureModelLoaded(fullParams);
    if (wasAborted(job)) return; // aborted while the model was loading (see abortJob)
    job.status = 'running';
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: srcAudio, filename: 'source.wav' }, referenceAudio });
    if (wasAborted(job)) return; // aborted while ACE-Step was accepting the submission
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, fullParams, result, title));
  }).finally(() => releaseGenLock(job.id));
  return job;
}
