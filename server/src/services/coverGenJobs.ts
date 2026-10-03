/**
 * "Create cover from audio": a `cover`-task generation conditioned on an
 * uploaded file or a client-bounced mix of an existing library song,
 * persisted as a brand-new song. Unlike remasterJobs.ts's scratch-only cover
 * pass (which re-renders a song's own current mix and is never saved), this
 * one goes through the same persistSong() path as a plain text2music
 * generation and shares its `generate` queue kind, so the rest of the app
 * (library GeneratingCard, cross-tab hydration) treats it identically.
 */
import crypto from 'node:crypto';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, type ReferenceAudioMeta, queueJob, persistSong, poll, ensureModelLoaded, wasAborted, drainTask } from './jobs.js';
import { resolveInferenceSteps } from './inferenceSteps.js';

export function startCoverGeneration(
  srcAudio: Buffer,
  title: string,
  params: ReleaseTaskParams,
  referenceAudio?: { data: Buffer; filename: string },
  folderId?: string | null,
  referenceMeta?: ReferenceAudioMeta | null,
): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'queued', createdAt: Date.now() };
  return queueJob({ kind: 'generate', title, caption: params.prompt, task: 'cover' }, job, async () => {
    // ACE-Step defaults batch_size to 2 server-side when omitted, but poll() only ever
    // keeps one result — force 1 so cover generation doesn't pay for a discarded take.
    // Only the PROMPT tab's TAKES slider (jobs.ts's startGeneration) picks batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'cover', batch_size: 1 };
    await ensureModelLoaded(fullParams);
    await resolveInferenceSteps(fullParams);
    if (wasAborted(job)) return; // aborted while the model was loading (see abortJob)
    job.status = 'running';
    const { task_id } = await releaseTask(fullParams, { srcAudio: { data: srcAudio, filename: 'source.wav' }, referenceAudio });
    if (wasAborted(job)) return drainTask(task_id); // aborted while ACE-Step was accepting it
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, fullParams, result, title, folderId, referenceMeta));
  });
}
