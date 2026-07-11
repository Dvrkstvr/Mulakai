/**
 * "Complete": ACE-Step's `complete` task builds a whole accompaniment around a
 * single bare track (e.g. a cappella vocals), unlike `cover` (regenerate a full
 * mix, structure preserved) or `lego`/Add Layer (add one part to an existing
 * multi-layer mix). Base-model only, and — unlike cover/repaint/extract — the
 * 5Hz LM is NOT skipped for this task (docs/ace-step-1.5/API.md#4.2), so
 * thinking/AI-enhance are meaningful here. Persists as a brand-new song via the
 * same persistSong() path coverGenJobs.ts uses, sharing its `generate` genLock
 * kind for identical library/hydration behavior.
 */
import crypto from 'node:crypto';
import { releaseTask, type ReleaseTaskParams } from './acestep.js';
import { type Job, type ReferenceAudioMeta, run, registerJob, persistSong, poll, ensureModelLoaded, wasAborted } from './jobs.js';
import { acquireGenLock, releaseGenLock } from './genLock.js';

export interface CompleteSource {
  data: Buffer;
  filename: string;
}

export function startCompleteGeneration(
  srcAudio: CompleteSource,
  title: string,
  params: ReleaseTaskParams,
  referenceAudio?: CompleteSource,
  folderId?: string | null,
  referenceMeta?: ReferenceAudioMeta | null,
): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: params.prompt });
  registerJob(job);
  void run(job, async () => {
    // ACE-Step defaults batch_size to 2 server-side when omitted, but poll() only ever
    // keeps one result — force 1 so complete generation doesn't pay for a discarded take.
    // Only the PROMPT tab's TAKES slider (jobs.ts's startGeneration) picks batch_size.
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'complete', batch_size: 1 };
    await ensureModelLoaded(fullParams);
    if (wasAborted(job)) return; // aborted while the model was loading (see abortJob)
    job.status = 'running';
    const { task_id } = await releaseTask(fullParams, { srcAudio, referenceAudio });
    if (wasAborted(job)) return; // aborted while ACE-Step was accepting the submission
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, fullParams, result, title, folderId, referenceMeta));
  }).finally(() => releaseGenLock(job.id));
  return job;
}
