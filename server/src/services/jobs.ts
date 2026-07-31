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
  releaseTask, queryResult, downloadAudio, initModel, lyricTimestamp, rawPathFromAudioUrl,
  type ReleaseTaskParams, type TaskResult,
} from './acestep.js';
import { reconcileAdapter } from './adapters.js';
import { resolveInferenceSteps } from './inferenceSteps.js';
import { parseOutputSettings, outputExt, MASTER_AUDIO_FORMAT } from './audioOutput.js';
import { transcodeBuffer } from './transcode.js';
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
  /** Live progress from ACE-Step's /query_result while status is 'running' — see poll(). */
  progress?: number;
  progressStage?: string;
  progressText?: string;
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
  // Strictly after init: adapters attach to the model, so an init above has just dropped
  // whichever one was loaded (see adapters.ts). ACE-Step has no per-request adapter param,
  // so this is the only place the selection can be honoured — and, since `params` is the
  // object every persist path records into versions.params_json, stamped.
  const adapter = await reconcileAdapter();
  if (adapter) params.adapter = adapter;
}

/** What reference audio (if any) conditioned a generation, persisted onto the song for the
 * Library detail rail. Influences are null for cover/complete, which don't remap them. */
export interface ReferenceAudioMeta {
  label: string;
  audioInfluence: number | null;
  styleInfluence: number | null;
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
  acquireGenLock({ kind: 'generate', jobId: job.id, title, caption: params.prompt, task: 'text2music' });
  jobs.set(job.id, job);
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
    if (ref) applyVoiceInfluence(fullParams, ref);
    const referenceMeta: ReferenceAudioMeta | null = ref
      ? { label: ref.name, audioInfluence: ref.audioInfluence, styleInfluence: ref.styleInfluence }
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

/** Wrap an async job body so any thrown error marks the job failed. Exported for coverGenJobs.ts's cover-from-audio flow. */
export async function run(job: Job, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

// A single failed status poll must not kill a long GPU run (the generation itself is
// unaffected), but persistent failure — e.g. every request timing out against a wedged
// backend — has to fail the job eventually or the genLock is held forever.
const MAX_POLL_STRIKES = 3;

export async function poll(job: Job, onSuccess: (result: TaskResult) => Promise<string>): Promise<void> {
  let strikes = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    if (job.status !== 'running') return; // aborted externally (see abortJob)
    let querying = true;
    try {
      const [row] = await queryResult([job.taskId]);
      querying = false;
      strikes = 0;
      if (!row) continue;
      if (row.status === 0) {
        job.progress = row.result?.[0]?.progress;
        job.progressStage = row.result?.[0]?.stage;
        job.progressText = row.progress_text;
        continue;
      }
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
      // Only status-poll failures earn strikes; a failed onSuccess (download/persist) is final.
      if (querying && ++strikes < MAX_POLL_STRIKES) continue;
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
    // ACE-Step's metas.duration is typed as number but comes back as the literal
    // string "N/A" for repaint/regenerate results where it isn't computed — Number()
    // that case is NaN, which the isFinite check below rejects instead of forwarding
    // an unparseable value that ACE-Step's /lyric_timestamp rejects with a 422.
    const duration = Number(result.metas.duration ?? params.audio_duration);
    if (!audioPath || !Number.isFinite(duration) || duration <= 0) return null;
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
  referenceMeta?: ReferenceAudioMeta | null,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  // ACE-Step hands back a wav32 master; the user's format/rate/depth is applied
  // here, once, on the way into audioDir (see transcode.ts).
  const out = parseOutputSettings(params.output);
  const filename = `${versionId}.${outputExt(out)}`;
  await transcodeBuffer(audio, path.join(config.audioDir, filename), out);
  await tagOutputFile(path.join(config.audioDir, filename), {
    title, bpm: result.metas.bpm ?? null, keyScale: result.metas.keyscale ?? '',
  });

  // Prefer the lyrics the user approved in Create over TaskResult's echoed `lyrics` —
  // ACE-Step's echo can come back with decoding artifacts, and every other write path
  // (repaintJobs.ts, versions.ts) already treats params.lyrics as the source of truth.
  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration, folder_id,
                        reference_audio_label, reference_audio_influence, reference_style_influence, gen_task)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    songId, title, result.prompt, params.lyrics || result.lyrics,
    result.metas.bpm ?? null, result.metas.keyscale ?? '',
    result.metas.timesignature ?? '', result.metas.duration ?? null,
    folderId ?? null,
    referenceMeta?.label ?? null, referenceMeta?.audioInfluence ?? null, referenceMeta?.styleInfluence ?? null,
    params.task_type ?? null,
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
