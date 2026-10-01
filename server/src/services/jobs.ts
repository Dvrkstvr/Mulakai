/**
 * Job orchestrator: release_task -> poll -> download -> persist.
 * Song-creation (text2music) lives here. Layer/version mutation paths
 * (repaint, regenerate) live in repaintJobs.ts and share the primitives
 * exported below.
 */
import crypto from 'node:crypto';
import {
  releaseTask, downloadAudio,
  type ReleaseTaskParams, type TaskResult,
} from './acestep.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { MASTER_AUDIO_FORMAT } from './audioOutput.js';
import { loadVoiceReference, applyStyleInfluence } from './voiceConditioning.js';
import { insertGeneratedSong, type ReferenceAudioMeta } from './songPersist.js';
import { acquireGenLock, releaseGenLock, getGenLock, type GenLockInfo } from './genLock.js';
import { type Job, getJob, registerJob, wasAborted } from './jobRegistry.js';
import { ensureModelLoaded } from './modelLoad.js';
import { run, poll } from './jobRunner.js';
import { fetchLyricTimestampsJson } from './lyricTimestamps.js';

export { type Job, getJob, registerJob, wasAborted, abortJob } from './jobRegistry.js';
export { ensureModelLoaded } from './modelLoad.js';
export { run, MAX_POLL_STRIKES, poll } from './jobRunner.js';
export { fetchLyricTimestampsJson } from './lyricTimestamps.js';

export type { ReferenceAudioMeta };

export interface VoiceOptions {
  voiceId?: string;
  audioInfluence?: number;
  styleInfluence?: number;
  /** An ad-hoc uploaded reference clip, used in place of a saved voice profile — same
   * style_influence remapping applies either way (see applyStyleInfluence). */
  referenceAudioFile?: { data: Buffer; filename: string };
}

/** Submit a text2music generation and persist the result as a new song with a base layer. */
export function startGeneration(params: ReleaseTaskParams, title: string, voice?: VoiceOptions, folderId?: string | null): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: params.prompt, task: 'text2music' });
  registerJob(job);
  void run(job, async () => {
    await ensureModelLoaded(params);
    // Resolve before fullParams is spread below — persistSong records fullParams into
    // versions.params_json, and resolving after would log AUTO for a run that used 50.
    await resolveInferenceSteps(params);
    if (wasAborted(job)) return; // aborted while the model was loading (see abortJob)
    job.status = 'running';
    // Always render the lossless master; params.output decides what lands on disk.
    const fullParams: ReleaseTaskParams = { ...params, audio_format: MASTER_AUDIO_FORMAT, task_type: 'text2music' };
    const ref = voice?.voiceId
      ? await loadVoiceReference(voice.voiceId, { audioInfluence: voice.audioInfluence, styleInfluence: voice.styleInfluence })
      : voice?.referenceAudioFile
        ? { name: voice.referenceAudioFile.filename, referenceAudio: voice.referenceAudioFile, audioInfluence: voice.audioInfluence ?? 0.5, styleInfluence: voice.styleInfluence ?? 0.5 }
        : undefined;
    // Style only: ACE-Step resets audio_cover_strength to neutral for text2music (upstream
    // #1305), so sending or recording an audio influence here would claim an effect it never had.
    if (ref) applyStyleInfluence(fullParams, ref.styleInfluence);
    const referenceMeta: ReferenceAudioMeta | null = ref
      ? { label: ref.name, audioInfluence: null, styleInfluence: ref.styleInfluence }
      : null;
    if (wasAborted(job)) return; // aborted while resolving the voice reference
    const { task_id } = await releaseTask(fullParams, ref ? { referenceAudio: ref.referenceAudio } : undefined);
    if (wasAborted(job)) return; // aborted while ACE-Step was accepting the submission
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, fullParams, result, title, folderId, referenceMeta));
  }).finally(() => releaseGenLock(job.id));
  return job;
}

/** The currently locked generation, if any, joined with its job record (kind `generate` only — other
 * kinds' jobs live in their own registries, e.g. stemSplit.ts's SplitJob map). Used to rehydrate the
 * client's library "generating" card across a page refresh. */
export function getActiveGeneration(): { lock: GenLockInfo | null; job?: Job } {
  const lock = getGenLock();
  return { lock, job: lock ? getJob(lock.jobId) : undefined };
}

/** Persist a task result as a brand-new song with a single base layer/version. Exported for coverGenJobs.ts. */
export async function persistSong(
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  title: string,
  folderId?: string | null,
  referenceMeta?: ReferenceAudioMeta | null,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  return insertGeneratedSong({
    audio,
    // Prefer the lyrics the user approved in Create over TaskResult's echoed `lyrics` —
    // ACE-Step's echo can come back with decoding artifacts, and every other write path
    // (repaintJobs.ts, versions.ts) already treats params.lyrics as the source of truth.
    meta: {
      caption: result.prompt,
      lyrics: params.lyrics || result.lyrics,
      bpm: result.metas.bpm ?? null,
      keyScale: result.metas.keyscale ?? '',
      timeSignature: result.metas.timesignature ?? '',
      duration: result.metas.duration ?? null,
      seed: result.seed_value,
    },
    params,
    lyricTimestamps,
    title,
    folderId,
    referenceMeta,
  });
}
