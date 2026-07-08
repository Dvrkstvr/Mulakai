/**
 * Job orchestrator: release_task -> poll -> download -> persist.
 * Song-creation (text2music) lives here. Layer/version mutation paths
 * (repaint, regenerate) live in repaintJobs.ts and share the primitives
 * exported below.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import {
  releaseTask, queryResult, downloadAudio, initModel, lyricTimestamp, rawPathFromAudioUrl, audioFileExt,
  type ReleaseTaskParams, type TaskResult,
} from './acestep.js';
import { loadVoiceReference, applyVoiceInfluence } from './voiceConditioning.js';
import { tagOutputFile } from './fileTags.js';
import { acquireGenLock, releaseGenLock, getGenLock, type GenLockInfo } from './genLock.js';

export interface Job {
  id: string;
  taskId: string;
  status: 'loading' | 'running' | 'done' | 'failed';
  error?: string;
  songId?: string;
  createdAt: number;
  /** Set by remasterJobs.ts on success; a scratch file path streamed once by remaster.ts's download route, then cleared. No other job type uses this. */
  resultPath?: string;
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Register a job created elsewhere (e.g. repaintJobs.ts) so getJob() can find it. */
export function registerJob(job: Job): void {
  jobs.set(job.id, job);
}

/**
 * Whether `job` was aborted since the caller last checked. A plain `job.status === 'failed'`
 * read works at runtime (another tick's abortJob call mutates the same object across an
 * `await`), but TS's control-flow narrowing doesn't know that and flags it as an impossible
 * comparison once a literal like `job.status = 'running'` appears earlier in the function —
 * routing the read through this helper sidesteps that narrowing.
 */
export function wasAborted(job: Job): boolean {
  return job.status === 'failed';
}

/**
 * Dev-facing abort: marks a job failed so `poll()` stops on its next tick and
 * releases the generation lock immediately, so the UI unblocks right away. Also
 * catches a job still in its pre-registration `run()` body (see repaintJobs.ts
 * etc.'s `wasAborted()` checks after each await) — every job-start function
 * registers its Job synchronously before its first await specifically so this
 * has something to mark right away, not just once polling begins.
 * The underlying ACE-Step task keeps running server-side (no cancel primitive
 * exists there, same caveat as stemSplit.ts's cancelSplit) — its eventual
 * result is simply ignored since `poll()` has already returned.
 */
export function abortJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  releaseGenLock(jobId);
  if (!job || job.status === 'done' || job.status === 'failed') return false;
  job.status = 'failed';
  job.error = 'Aborted';
  return true;
}

/**
 * Load the requested model into slot 1 if a specific one was chosen.
 * AUTO (no model / no LM selected) skips init and lets ACE-Step lazy-load its
 * own defaults. The 5Hz LM is silently skipped by ACE-Step for repaint/cover/
 * extract task types (docs/ace-step-1.5/API.md#4.2), so an LM selection is
 * ignored here for those task types rather than wastefully loaded.
 */
export async function ensureModelLoaded(params: ReleaseTaskParams): Promise<void> {
  const lmIgnored = params.task_type === 'repaint' || params.task_type === 'cover' || params.task_type === 'extract';
  const lmSelected = !lmIgnored && !!params.lm_model_path;
  const needLlm = !lmIgnored && (!!params.thinking || !!params.use_format || lmSelected);
  if (params.model || lmSelected) {
    await initModel({ model: params.model, lmModel: lmSelected ? params.lm_model_path : undefined, initLlm: needLlm });
  }
}

export interface VoiceOptions {
  voiceId?: string;
  audioInfluence?: number;
  styleInfluence?: number;
  /** An ad-hoc uploaded reference clip, used in place of a saved voice profile — same
   * audio_influence/style_influence remapping applies either way (see applyVoiceInfluence). */
  referenceAudioFile?: { data: Buffer; filename: string };
}

/** Submit a text2music generation and persist the result as a new song with a base layer. */
export function startGeneration(params: ReleaseTaskParams, title: string, voice?: VoiceOptions, folderId?: string | null): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: params.prompt });
  jobs.set(job.id, job);
  void run(job, async () => {
    await ensureModelLoaded(params);
    if (wasAborted(job)) return; // aborted while the model was loading (see abortJob)
    job.status = 'running';
    const fullParams: ReleaseTaskParams = { audio_format: 'wav', ...params, task_type: 'text2music' };
    const ref = voice?.voiceId
      ? await loadVoiceReference(voice.voiceId, { audioInfluence: voice.audioInfluence, styleInfluence: voice.styleInfluence })
      : voice?.referenceAudioFile
        ? { referenceAudio: voice.referenceAudioFile, audioInfluence: voice.audioInfluence ?? 0.5, styleInfluence: voice.styleInfluence ?? 0.5 }
        : undefined;
    if (ref) applyVoiceInfluence(fullParams, ref);
    if (wasAborted(job)) return; // aborted while resolving the voice reference
    const { task_id } = await releaseTask(fullParams, ref ? { referenceAudio: ref.referenceAudio } : undefined);
    if (wasAborted(job)) return; // aborted while ACE-Step was accepting the submission
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, fullParams, result, title, folderId));
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

/** Wrap an async job body so any thrown error marks the job failed. Exported for coverGenJobs.ts's cover-from-audio flow. */
export async function run(job: Job, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

export async function poll(job: Job, onSuccess: (result: TaskResult) => Promise<string>): Promise<void> {
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (job.status !== 'running') return; // aborted externally (see abortJob)
    try {
      const [row] = await queryResult([job.taskId]);
      if (!row || row.status === 0) continue;
      if (row.status === 2) {
        job.status = 'failed';
        job.error = 'generation failed';
        return;
      }
      const result = row.result.find((r) => r.status === 1) ?? row.result[0];
      if (!result?.file) {
        job.status = 'failed';
        job.error = 'no audio in result';
        return;
      }
      job.songId = await onSuccess(result);
      job.status = 'done';
      return;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      return;
    }
  }
}

/**
 * Best-effort lyric alignment, fetched at generation time while ACE-Step's
 * artifact sidecar still exists (it lives in ACE-Step's temp dir and is cleaned
 * up later, so it can't be fetched lazily from the editor). Returns a JSON
 * string for the `versions.lyric_timestamps` column, or null when unavailable —
 * a missing sidecar (404), instrumental track, or any error is non-fatal and
 * must never fail the surrounding generation.
 */
export async function fetchLyricTimestampsJson(
  result: TaskResult,
  params: ReleaseTaskParams,
): Promise<string | null> {
  // Everything is inside the try: this is best-effort and must never throw into
  // the surrounding generation — a 404 (no sidecar), instrumental track, or any
  // other error just means "no timestamps".
  try {
    const audioPath = rawPathFromAudioUrl(result.file);
    const duration = result.metas.duration ?? params.audio_duration;
    if (!audioPath || !duration || duration <= 0) return null;
    const aligned = await lyricTimestamp({
      audioPath,
      duration,
      vocalLanguage: params.vocal_language,
      inferenceSteps: params.inference_steps,
      model: params.model,
    });
    if (!aligned.success || aligned.sentence_timestamps.length === 0) return null;
    return JSON.stringify(aligned.sentence_timestamps);
  } catch {
    return null;
  }
}

/** Persist a task result as a brand-new song with a single base layer/version. Exported for coverGenJobs.ts. */
export async function persistSong(
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  title: string,
  folderId?: string | null,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.${audioFileExt(params.audio_format)}`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);
  await tagOutputFile(path.join(config.audioDir, filename), {
    title, bpm: result.metas.bpm ?? null, keyScale: result.metas.keyscale ?? '',
  });

  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration, folder_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    songId, title, result.prompt, result.lyrics,
    result.metas.bpm ?? null, result.metas.keyscale ?? '',
    result.metas.timesignature ?? '', result.metas.duration ?? null,
    folderId ?? null,
  );
  db.prepare(
    `INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`,
  ).run(layerId, songId);
  db.prepare(
    `INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, lyric_timestamps)
     VALUES (?, ?, ?, 'first generation', ?, ?, ?)`,
  ).run(versionId, layerId, filename, JSON.stringify(params), result.seed_value, lyricTimestamps);

  return songId;
}
