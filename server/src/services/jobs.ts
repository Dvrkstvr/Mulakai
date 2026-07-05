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

export interface Job {
  id: string;
  taskId: string;
  status: 'loading' | 'running' | 'done' | 'failed';
  error?: string;
  songId?: string;
  createdAt: number;
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

/** Submit a text2music generation and persist the result as a new song with a base layer. */
export function startGeneration(params: ReleaseTaskParams, title: string): Job {
  const job: Job = { id: crypto.randomUUID(), taskId: '', status: 'loading', createdAt: Date.now() };
  jobs.set(job.id, job);
  void run(job, async () => {
    await ensureModelLoaded(params);
    job.status = 'running';
    const { task_id } = await releaseTask({ audio_format: 'mp3', ...params, task_type: 'text2music' });
    job.taskId = task_id;
    await poll(job, (result) => persistSong(result.file, params, result, title));
  });
  return job;
}

/** Wrap an async job body so any thrown error marks the job failed. */
async function run(job: Job, body: () => Promise<void>): Promise<void> {
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
  const audioPath = rawPathFromAudioUrl(result.file);
  const duration = result.metas.duration ?? params.audio_duration;
  if (!audioPath || !duration || duration <= 0) return null;
  try {
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
    return null; // 404 (no sidecar) or transport error — no timestamps, not a failure.
  }
}

async function persistSong(
  fileUrl: string,
  params: ReleaseTaskParams,
  result: TaskResult,
  title: string,
): Promise<string> {
  const audio = await downloadAudio(fileUrl);
  const lyricTimestamps = await fetchLyricTimestampsJson(result, params);
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const filename = `${versionId}.mp3`;
  await fs.writeFile(path.join(config.audioDir, filename), audio);

  db.prepare(
    `INSERT INTO songs (id, title, caption, lyrics, bpm, key_scale, time_signature, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    songId, title, result.prompt, result.lyrics,
    result.metas.bpm ?? null, result.metas.keyscale ?? '',
    result.metas.timesignature ?? '', result.metas.duration ?? null,
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
